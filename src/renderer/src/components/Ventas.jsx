import { useState, useMemo } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useDb } from '../hooks/useDb'
import Modal from './Modal'
import ReporteVentasPDF from './ReporteVentasPDF'

const EMPTY_FORM = { lote_id: '', fecha: '', pesos_input: '', precio_kg: '' }

function generateId() { return `venta-${Date.now()}` }

function fmt(value) {
  return Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

function parsePesos(input) {
  return input.split(',').map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p) && p > 0)
}

const inputCls = "w-full bg-[#080b13] border border-white/[0.08] text-slate-100 rounded-lg px-4 py-3 text-sm placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function Ventas() {
  const { data: ventas, loading: lv, add, update, remove } = useDb('ventas')
  const { data: lotes, loading: ll, update: updateLote } = useDb('lotes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterLote, setFilterLote] = useState('todos')

  const vendidosPorLote = useMemo(() => {
    const map = {}
    for (const v of ventas) map[v.lote_id] = (map[v.lote_id] || 0) + v.cantidad
    return map
  }, [ventas])

  const preview = useMemo(() => {
    const pesos = parsePesos(form.pesos_input)
    const precio = parseFloat(form.precio_kg) || 0
    const totalKg = pesos.reduce((a, b) => a + b, 0)
    return { pesos, totalKg, total: totalKg * precio, cantidad: pesos.length }
  }, [form.pesos_input, form.precio_kg])

  const loteSeleccionado = useMemo(() => lotes.find((l) => l.id === form.lote_id), [lotes, form.lote_id])
  const editingVenta = useMemo(() => editingId ? ventas.find((v) => v.id === editingId) : null, [editingId, ventas])
  const cerdosDisponibles = useMemo(() => {
    if (!loteSeleccionado) return null
    const vendidos = vendidosPorLote[loteSeleccionado.id] || 0
    // Al editar, devolver la cantidad actual de esta venta al cupo disponible
    const offset = editingVenta?.lote_id === loteSeleccionado.id ? editingVenta.cantidad : 0
    return loteSeleccionado.cantidad - vendidos + offset
  }, [loteSeleccionado, vendidosPorLote, editingVenta])

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true) }
  function openEdit(venta) {
    setForm({ lote_id: venta.lote_id, fecha: venta.fecha, pesos_input: (venta.pesos_kg ?? []).join(', '), precio_kg: String(venta.precio_kg) })
    setEditingId(venta.id); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null) }

  async function syncLoteEstado(lote_id, delta) {
    const lote = lotes.find((l) => l.id === lote_id)
    if (!lote) return
    const newVendidos = (vendidosPorLote[lote_id] || 0) + delta
    const newEstado = newVendidos >= lote.cantidad ? 'inactivo' : 'activo'
    if (lote.estado !== newEstado) await updateLote(lote_id, { estado: newEstado })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (preview.cantidad === 0 || (cerdosDisponibles !== null && preview.cantidad > cerdosDisponibles)) return
    const payload = { lote_id: form.lote_id, fecha: form.fecha, pesos_kg: preview.pesos, precio_kg: parseFloat(form.precio_kg), cantidad: preview.cantidad, total_kg: preview.totalKg, total: preview.total }
    if (editingId) {
      await update(editingId, payload)
      if (editingVenta.lote_id !== form.lote_id) {
        await syncLoteEstado(editingVenta.lote_id, -editingVenta.cantidad)
        await syncLoteEstado(form.lote_id, +preview.cantidad)
      } else {
        await syncLoteEstado(form.lote_id, preview.cantidad - editingVenta.cantidad)
      }
    } else {
      await add({ id: generateId(), ...payload })
      await syncLoteEstado(form.lote_id, +preview.cantidad)
    }
    closeForm()
  }

  async function handleDelete(id) {
    const venta = ventas.find((v) => v.id === id)
    await remove(id)
    setConfirmDelete(null)
    if (venta) await syncLoteEstado(venta.lote_id, -venta.cantidad)
  }

  const ventasFiltradas = useMemo(() => filterLote === 'todos' ? ventas : ventas.filter((v) => v.lote_id === filterLote), [ventas, filterLote])
  const [expandedId, setExpandedId] = useState(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  function toggleExpand(id) { setExpandedId((prev) => prev === id ? null : id) }

  async function handleDescargarReporte() {
    setGenerandoPdf(true)
    try {
      const doc = <ReporteVentasPDF ventas={ventasFiltradas} lotes={lotes} loteId={filterLote} />
      const blob = await pdf(doc).toBlob()
      const arrayBuffer = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)
      const loteNombre = filterLote === 'todos' ? 'todos' : lotes.find((l) => l.id === filterLote)?.nombre ?? filterLote
      await window.api.pdf.guardar(base64, `ventas_${loteNombre}.pdf`)
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (lv || ll) return <p className="text-slate-600 text-sm">Cargando...</p>

  return (
    <div className="space-y-5">
      {/* ── Stock cards ── */}
      {lotes.some((l) => l.estado === 'activo') && (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {lotes.filter((l) => l.estado === 'activo').map((lote) => {
            const vendidos = vendidosPorLote[lote.id] || 0
            const pendientes = lote.cantidad - vendidos
            const pct = lote.cantidad > 0 ? (vendidos / lote.cantidad) * 100 : 0
            return (
              <div key={lote.id} className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-200 mb-3 truncate">{lote.nombre}</p>
                <div className="flex justify-between text-xs mb-2.5">
                  <span className="text-slate-500">Total <strong className="text-slate-300">{lote.cantidad}</strong></span>
                  <span className="text-slate-500">Vendidos <strong className="text-emerald-400">{vendidos}</strong></span>
                  <span className="text-slate-500">Quedan <strong className={pendientes === 0 ? 'text-slate-600' : 'text-amber-400'}>{pendientes}</strong></span>
                </div>
                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{ventasFiltradas.length} venta(s)</span>
          <select value={filterLote} onChange={(e) => setFilterLote(e.target.value)} className="bg-[#0d1117] border border-white/[0.06] text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 transition-all" style={{ colorScheme: 'dark' }}>
            <option value="todos">Todos los lotes</option>
            {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={handleDescargarReporte} disabled={generandoPdf || ventasFiltradas.length === 0} title="Descargar reporte PDF" className="flex items-center gap-2 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
            {generandoPdf
              ? <span className="w-3.5 h-3.5 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin" />
              : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 10v2.667A1.333 1.333 0 0112.667 14H3.333A1.333 1.333 0 012 12.667V10"/><polyline points="4.667 6.667 8 10 11.333 6.667"/><line x1="8" y1="10" x2="8" y2="2"/></svg>
            }
            PDF
          </button>
          <button onClick={openNew} className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg>
            Registrar venta
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {ventasFiltradas.length === 0 ? (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-16 text-center">
          <p className="text-slate-600 text-sm">No hay ventas registradas.</p>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Lote', 'Fecha', 'Cerdos', 'Peso total', 'Precio/kg', 'Total', ''].map((h, i) => (
                  <th key={i} className={`px-5 py-3.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider ${i >= 2 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventasFiltradas.map((venta) => {
                const lote = lotes.find((l) => l.id === venta.lote_id)
                const isExpanded = expandedId === venta.id
                const pesos = venta.pesos_kg ?? []
                return (
                  <>
                    <tr
                      key={venta.id}
                      onClick={() => toggleExpand(venta.id)}
                      className={`border-t border-white/[0.04] cursor-pointer transition-colors group ${isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        <div className="flex items-center gap-2">
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 text-slate-600 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            <polyline points="6 4 10 8 6 12" />
                          </svg>
                          {lote?.nombre ?? '—'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{venta.fecha}</td>
                      <td className="px-5 py-3.5 text-right text-slate-300">{venta.cantidad}</td>
                      <td className="px-5 py-3.5 text-right text-slate-300">{venta.total_kg} kg</td>
                      <td className="px-5 py-3.5 text-right text-slate-300">{fmt(venta.precio_kg)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">{fmt(venta.total)}</td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(venta)} title="Editar" className="text-slate-600 hover:text-blue-400 transition-colors">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H2v-3L11.5 2.5z"/></svg>
                          </button>
                          <button onClick={() => setConfirmDelete(venta.id)} title="Eliminar" className="text-slate-600 hover:text-red-400 transition-colors">
                            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="2 4 14 4"/><path d="M12 4l-.867 9.071A1 1 0 0110.138 14H5.862a1 1 0 01-.995-.929L4 4"/><path d="M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${venta.id}-detail`} className="border-t border-white/[0.04] bg-white/[0.02]">
                        <td colSpan={7} className="px-5 py-4">
                          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">Pesos individuales</p>
                          <div className="flex flex-wrap gap-2">
                            {pesos.map((peso, i) => (
                              <div key={i} className="flex flex-col items-center bg-[#0d1117] border border-white/[0.06] rounded-lg px-3 py-2 min-w-[56px]">
                                <span className="text-[10px] text-slate-600 mb-0.5">{i + 1}</span>
                                <span className="text-sm font-semibold text-slate-200">{peso}</span>
                              </div>
                            ))}
                            <div className="flex flex-col items-center bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2 min-w-[56px] ml-2">
                              <span className="text-[10px] text-slate-500 mb-0.5">Total</span>
                              <span className="text-sm font-semibold text-emerald-400">{venta.total_kg}</span>
                              <span className="text-[10px] text-slate-500">kg</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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
            <div className="modal-panel bg-[#111620] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg border border-white/[0.06]">
              <div className="px-7 pt-7 pb-5">
                <h3 className="text-base font-semibold text-white">{editingId ? 'Editar venta' : 'Registrar venta'}</h3>
                <p className="text-sm text-slate-500 mt-1">{editingId ? 'Corrige los datos de la venta' : 'Ingresa los detalles de la venta'}</p>
              </div>
              <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-5 max-h-[70vh] overflow-y-auto">
                <Field label="Lote">
                  <select name="lote_id" value={form.lote_id} onChange={handleChange} required className={inputCls} style={{ colorScheme: 'dark' }}>
                    <option value="">Selecciona un lote</option>
                    {lotes.map((l) => {
                      const disponibles = l.cantidad - (vendidosPorLote[l.id] || 0)
                      return <option key={l.id} value={l.id} disabled={disponibles === 0}>{l.nombre} ({disponibles} disponibles)</option>
                    })}
                  </select>
                  {cerdosDisponibles !== null && <p className="text-xs text-slate-500">{cerdosDisponibles} cerdo(s) disponibles en este lote</p>}
                </Field>

                <Field label="Fecha">
                  <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required className={inputCls} style={{ colorScheme: 'dark' }} />
                </Field>

                <Field
                  label="Pesos en kg — separados por coma"
                  hint={preview.cantidad > 0 ? `${preview.cantidad} cerdo(s) · ${preview.totalKg.toFixed(1)} kg total${cerdosDisponibles !== null && preview.cantidad > cerdosDisponibles ? ' — Supera los disponibles' : ''}` : undefined}
                >
                  <input name="pesos_input" value={form.pesos_input} onChange={handleChange} required placeholder="Ej: 85, 90, 78, 92" className={inputCls} />
                </Field>

                <Field label="Precio por kg ($)">
                  <input type="number" name="precio_kg" value={form.precio_kg} onChange={handleChange} required min="0" placeholder="Ej: 5200" className={inputCls} />
                </Field>

                {preview.total > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-5 py-4">
                    <p className="text-xs text-slate-500 mb-1">Total estimado</p>
                    <p className="text-xl font-bold text-emerald-400">{fmt(preview.total)}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="flex-1 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] py-3 rounded-xl text-sm font-medium transition-all">Cancelar</button>
                  <button type="submit" disabled={preview.cantidad === 0 || (cerdosDisponibles !== null && preview.cantidad > cerdosDisponibles)} className="flex-1 bg-gradient-to-r from-emerald-600 to-green-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">{editingId ? 'Guardar cambios' : 'Registrar'}</button>
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
                <p className="text-white font-semibold mb-1.5">¿Eliminar esta venta?</p>
                <p className="text-slate-500 text-sm mb-6">Los cerdos volverán a contarse como disponibles.</p>
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
