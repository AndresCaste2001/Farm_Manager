import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Tesseract from 'tesseract.js'
import icon from '../../resources/icon.png?asset'

// ── Data directory setup ──────────────────────────────────────────────────────
const DATA_DIR = join(app.getPath('userData'), 'data')
const COLLECTIONS = ['lotes', 'pagos', 'ventas']

function initDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  for (const col of COLLECTIONS) {
    const file = join(DATA_DIR, `${col}.json`)
    if (!existsSync(file)) writeFileSync(file, '[]', 'utf-8')
  }
}

function readCollection(name) {
  const file = join(DATA_DIR, `${name}.json`)
  return JSON.parse(readFileSync(file, 'utf-8'))
}

function writeCollection(name, data) {
  const file = join(DATA_DIR, `${name}.json`)
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
}

// ── OCR helpers ───────────────────────────────────────────────────────────────
function parseOcrText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // Total documento
  let total = null
  const totalMatch = text.match(/TOTAL\s+DOCUMENTO[^0-9]*([0-9][0-9.,]+)/i)
  if (totalMatch) {
    total = parseFloat(totalMatch[1].replace(/\./g, '').replace(',', '.'))
  }

  // Fecha — priorizar formato español "d de mes de yyyy" (más confiable que dd-mmm-yy)
  let fecha = null
  const meses = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 }
  const fechaEsMatch = text.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i)
  if (fechaEsMatch) {
    const d = fechaEsMatch[1].padStart(2, '0')
    const m = String(meses[fechaEsMatch[2].toLowerCase()]).padStart(2, '0')
    fecha = `${fechaEsMatch[3]}-${m}-${d}`
  } else {
    // Fallback: dd-mmm-yy solo en contexto de FECHA DOCUMENTO, no vencimiento
    const mesesCortos = { jan:1,ene:1,feb:2,mar:3,abr:4,apr:4,may:5,jun:6,jul:7,ago:8,aug:8,sep:9,oct:10,nov:11,dic:12,dec:12 }
    const fechaDocMatch = text.match(/FECHA\s+DOCUMENTO[\s\S]{0,80}?(\d{2}-[a-zA-Z]{3}-\d{2,4})/)
    if (fechaDocMatch) {
      const parts = fechaDocMatch[1].split('-')
      const m = mesesCortos[parts[1].toLowerCase()]
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
      if (m) fecha = `${y}-${String(m).padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // Proveedor — primera línea significativa, sin corchetes
  let proveedor = null
  const skipProveedor = /^(nit|cliente|fecha|cotiz|factura|direcc|ciudad|telef|\[nr|\[cot)/i
  for (const line of lines) {
    if (line.length > 5 && !skipProveedor.test(line)) {
      proveedor = line.replace(/[\[\]]/g, '').trim()
      break
    }
  }

  // Descripción — líneas entre VENDEDOR/FORMA DE PAGO y SUBTOTAL/VALOR EN LETRAS
  let descripcion = null
  const subtotalIdx = lines.findIndex((l) => /subtotal|valor en letras/i.test(l))
  const vendedorIdx = lines.findIndex((l) => /vendedor|forma de pago/i.test(l))

  if (subtotalIdx > 0) {
    const startIdx = vendedorIdx !== -1 ? vendedorIdx + 1 : Math.max(0, subtotalIdx - 4)
    const skipDesc = /^(descripci|cantidad|u\.?\s*medida|valor|iva|total|\d+$|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i
    const candidates = lines
      .slice(startIdx, subtotalIdx)
      .map((l) => l.replace(/[\[\]"']/g, '').trim())
      .filter((l) => l.length > 5 && !skipDesc.test(l) && !/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/.test(l) && !/\d{2}-[a-z]{3}-\d{2}/i.test(l))

    if (candidates.length > 0) {
      // Quitar números y unidades al final de la línea (precio, cantidad)
      const cleaned = candidates[0].replace(/\s+[\d.,\s"]+$/, '').trim()
      descripcion = cleaned.substring(0, 150)
    }
  }

  return { total, fecha, proveedor, descripcion }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers() {
  ipcMain.handle('db:get', (_e, collection) => readCollection(collection))

  ipcMain.handle('db:save', (_e, collection, data) => {
    writeCollection(collection, data)
    return true
  })

  // Abrir imagen o PDF
  ipcMain.handle('dialog:openFactura', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Imágenes / PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'] }],
      properties: ['openFile']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // Guardar PDF generado
  ipcMain.handle('dialog:savePdf', async (_e, base64Data, defaultName) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName ?? 'reporte.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (result.canceled) return false
    const buffer = Buffer.from(base64Data, 'base64')
    writeFileSync(result.filePath, buffer)
    return true
  })

  // OCR sobre imagen (por ruta)
  ipcMain.handle('ocr:leerFactura', async (_e, filePath) => {
    try {
      const { data } = await Tesseract.recognize(filePath, 'spa', {
        logger: () => {}
      })
      const campos = parseOcrText(data.text)
      return { ok: true, texto: data.text, campos }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // OCR sobre imagen (por buffer — drag & drop)
  ipcMain.handle('ocr:leerFacturaBuffer', async (_e, buffer, ext) => {
    const tmpPath = join(app.getPath('temp'), `factura_ocr_${Date.now()}.${ext}`)
    try {
      writeFileSync(tmpPath, Buffer.from(buffer))
      const { data } = await Tesseract.recognize(tmpPath, 'spa', { logger: () => {} })
      const campos = parseOcrText(data.text)
      return { ok: true, texto: data.text, campos }
    } catch (err) {
      return { ok: false, error: err.message }
    } finally {
      try { unlinkSync(tmpPath) } catch {}
    }
  })
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    icon,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#06080f',
      symbolColor: '#64748b',
      height: 40
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  initDataDir()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
