import { useState, useMemo, useRef } from 'react'
import { useDb } from '../hooks/useDb'
import Modal from './Modal'

const TIPOS = ['alimentacion', 'veterinaria', 'otro']
const EMPTY_FORM = { lote_id: '', fecha: '', monto: '', descripcion: '', tipo: 'alimentacion', proveedor: '' }

function generateId() { return `pago-${Date.now()}` }

function fmt(value) {
  return Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const TIPO_STYLES = {
  alimentacion: 'bg-blue-500/10 text-blue-400',
  veterinaria:  'bg-purple-500/10 text-purple-400',
  otro:         'bg-white/[0.04] text-slate-400'
}

const inputCls = "w-full bg-[#080b13] border border-white/[0.08] text-slate-100 rounded-lg px-4 py-3 text-sm placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

export default function Pagos() {
  const { data: pagos, loading: lp, add, update, remove } = useDb('pagos')
  const { data: lotes, loading: ll } = useDb('lotes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterLote, setFilterLote] = useState('todos')
  const [ocrState, setOcrState] = useState('idle')
  const [ocrTexto, setOcrTexto] = useState('')
  const [showOcrTexto, setShowOcrTexto] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setOcrState('idle'); setOcrTexto(''); setShowForm(true) }
  function openEdit(pago) {
    setForm({ lote_id: pago.lote_id, fecha: pago.fecha, monto: String(pago.monto), descripcion: pago.descripcion ?? '', tipo: pago.tipo, proveedor: pago.proveedor ?? '' })
    setEditingId(pago.id); setOcrState('idle'); setOcrTexto(''); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); setOcrState('idle'); setOcrTexto('') }

  async function runOcr(filePath) {
    setOcrState('loading')
    const result = await window.api.factura.leerOcr(filePath)
    if (!result.ok) { setOcrState('error'); return }
    setOcrTexto(result.texto)
    setOcrState('done')
    const { campos } = result
    setForm((prev) => ({
      ...prev,
      fecha: campos.fecha ?? prev.fecha,
      monto: campos.total != null ? String(campos.total) : prev.monto,
      descripcion: campos.descripcion ?? prev.descripcion,
      proveedor: campos.proveedor ?? prev.proveedor
    }))
  }

  async function handleOcr() {
    setOcrState('loading')
    const filePath = await window.api.factura.abrirDialog()
    if (!filePath) { setOcrState('idle'); return }
    await runOcr(filePath)
  }

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  function handleDragOver(e) { e.preventDefault() }

  async function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!showForm) { setForm(EMPTY_FORM); setOcrTexto(''); setShowForm(true) }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const buffer = await file.arrayBuffer()
    setOcrState('loading')
    const result = await window.api.factura.leerOcrBuffer(buffer, ext)
    if (!result.ok) { setOcrState('error'); return }
    setOcrTexto(result.texto)
    setOcrState('done')
    const { campos } = result
    setForm((prev) => ({
      ...prev,
      fecha: campos.fecha ?? prev.fecha,
      monto: campos.total != null ? String(campos.total) : prev.monto,
      descripcion: campos.descripcion ?? prev.descripcion,
      proveedor: campos.proveedor ?? prev.proveedor
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = { lote_id: form.lote_id, fecha: form.fecha, monto: parseFloat(form.monto), descripcion: form.descripcion, tipo: form.tipo, proveedor: form.proveedor }
    if (editingId) await update(editingId, payload)
    else await add({ id: generateId(), ...payload })
    closeForm()
  }

  async function handleDelete(id) { await remove(id); setConfirmDelete(null) }

  const pagosFiltrados = useMemo(() => filterLote === 'todos' ? pagos : pagos.filter((p) => p.lote_id === filterLote), [pagos, filterLote])
  const totalFiltrado = useMemo(() => pagosFiltrados.reduce((s, p) => s + p.monto, 0), [pagosFiltrados])

  if (lp || ll) return <p className="text-slate-600 text-sm">Cargando...</p>

  return (
    <div
      className="relative space-y-5"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ── */}
      {isDragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-emerald-500/60 bg-emerald-500/[0.04]" />
          <div className="relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-emerald-400">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-white font-semibold">Suelta para leer la factura</p>
            <p className="text-slate-500 text-sm mt-1">Se abrirá el formulario automáticamente</p>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select value={filterLote} onChange={(e) => setFilterLote(e.target.value)} className="bg-[#0d1117] border border-white/[0.06] text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 transition-all" style={{ colorScheme: 'dark' }}>
            <option value="todos">Todos los lotes</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          {pagosFiltrados.length > 0 && (
            <span className="text-sm text-slate-500">Total: <strong className="text-red-400">{fmt(totalFiltrado)}</strong></span>
          )}
        </div>
        <button onClick={openNew} className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg>
          Registrar pago
        </button>
      </div>

      {/* ── Table ── */}
      {pagosFiltrados.length === 0 ? (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-16 text-center">
          <p className="text-slate-600 text-sm">No hay pagos registrados.</p>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Lote', 'Fecha', 'Proveedor', 'Descripción', 'Tipo', 'Monto', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider ${i === 5 ? 'text-right' : i === 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {pagosFiltrados.map((pago) => {
                const lote = lotes.find((l) => l.id === pago.lote_id)
                return (
                  <tr key={pago.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-3.5 font-medium text-slate-200">{lote?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{pago.fecha}</td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-[8rem] truncate">{pago.proveedor || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-400 max-w-[12rem] truncate">{pago.descripcion || '—'}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold ${TIPO_STYLES[pago.tipo] ?? TIPO_STYLES.otro}`}>{pago.tipo}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-red-400">{fmt(pago.monto)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(pago)} title="Editar" className="text-slate-600 hover:text-blue-400 transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H2v-3L11.5 2.5z"/></svg>
                        </button>
                        <button onClick={() => setConfirmDelete(pago.id)} title="Eliminar" className="text-slate-600 hover:text-red-400 transition-colors">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="2 4 14 4"/><path d="M12 4l-.867 9.071A1 1 0 0110.138 14H5.862a1 1 0 01-.995-.929L4 4"/><path d="M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showForm && (
        <Modal>
          <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="modal-panel bg-[#111620] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-xl border border-white/[0.06]">
              <div className="px-7 pt-7 pb-5">
                <h3 className="text-base font-semibold text-white">{editingId ? 'Editar pago' : 'Registrar pago'}</h3>
                <p className="text-sm text-slate-500 mt-1">{editingId ? 'Corrige los datos del pago' : 'Manual o desde imagen de factura'}</p>
              </div>

              {/* OCR section */}
              <div className="mx-7 mb-5 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">Leer desde imagen / PDF</p>
                    <p className="text-xs text-slate-500 mt-0.5">Extrae los datos automáticamente con OCR</p>
                  </div>
                  <button type="button" onClick={handleOcr} disabled={ocrState === 'loading'}
                    className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all whitespace-nowrap">
                    {ocrState === 'loading'
                      ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Leyendo...</>
                      : 'Seleccionar archivo'}
                  </button>
                </div>
                {ocrState === 'done' && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-emerald-400 font-medium">Datos extraídos — revisa y corrige si es necesario</span>
                    <button type="button" onClick={() => setShowOcrTexto(!showOcrTexto)} className="text-xs text-slate-500 hover:text-slate-300 underline">{showOcrTexto ? 'Ocultar texto' : 'Ver texto OCR'}</button>
                  </div>
                )}
                {ocrState === 'error' && <p className="text-xs text-red-400 mt-2">Error al leer el archivo. Ingresa los datos manualmente.</p>}
                {showOcrTexto && ocrTexto && (
                  <pre className="mt-3 text-xs bg-[#06080f] border border-white/[0.06] rounded-lg p-3 max-h-24 overflow-auto text-slate-500 whitespace-pre-wrap">{ocrTexto}</pre>
                )}
              </div>

              <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-5 max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Lote">
                    <select name="lote_id" value={form.lote_id} onChange={handleChange} required className={inputCls} style={{ colorScheme: 'dark' }}>
                      <option value="">Selecciona</option>
                      {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha">
                    <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className={inputCls} style={{ colorScheme: 'dark' }} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Monto ($)">
                    <input type="number" name="monto" value={form.monto} onChange={handleChange} required min="0" placeholder="960960" className={inputCls} />
                  </Field>
                  <Field label="Tipo">
                    <select name="tipo" value={form.tipo} onChange={handleChange} className={inputCls} style={{ colorScheme: 'dark' }}>
                      {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Proveedor">
                  <input name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="Ej: Campo Nuevo del Oriente S.A.S" className={inputCls} />
                </Field>
                <Field label="Descripción">
                  <input name="descripcion" value={form.descripcion} onChange={handleChange} placeholder="Ej: Chanchitos GP Pelet X40 KG" className={inputCls} />
                </Field>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="flex-1 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] py-3 rounded-xl text-sm font-medium transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-emerald-600 to-green-500 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">{editingId ? 'Guardar cambios' : 'Guardar pago'}</button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {confirmDelete && (
        <Modal>
          <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="modal-panel bg-[#111620] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-sm border border-white/[0.06]">
              <div className="p-7 text-center">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-red-400">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </div>
                <p className="text-white font-semibold mb-1.5">¿Eliminar este pago?</p>
                <p className="text-slate-500 text-sm mb-6">Esta acción no se puede deshacer.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] py-3 rounded-xl text-sm font-medium transition-all">Cancelar</button>
                  <button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl text-sm font-semibold transition-all">Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
