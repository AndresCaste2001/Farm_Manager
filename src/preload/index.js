import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  db: {
    get: (collection) => ipcRenderer.invoke('db:get', collection),
    save: (collection, data) => ipcRenderer.invoke('db:save', collection, data)
  },
  factura: {
    abrirDialog: () => ipcRenderer.invoke('dialog:openFactura'),
    leerOcr: (filePath) => ipcRenderer.invoke('ocr:leerFactura', filePath),
    leerOcrBuffer: (buffer, ext) => ipcRenderer.invoke('ocr:leerFacturaBuffer', buffer, ext)
  },
  pdf: {
    guardar: (base64Data, defaultName) => ipcRenderer.invoke('dialog:savePdf', base64Data, defaultName)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
