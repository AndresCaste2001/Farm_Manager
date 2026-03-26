import { useState } from 'react'
import { useDb } from '../hooks/useDb'
import Modal from './Modal'

const EMPTY_FORM = { nombre: '', fecha_entrada: '', cantidad: '', costo_por_cerdo: '' }

function generateId() { return `lote-${Date.now()}` }

function fmt(value) {
  return Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
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

export default function Lotes() {
  const { data: lotes, loading, add, update, remove } = useDb('lotes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }
  function openNew() { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true) }
  function openEdit(lote) {
    setForm({ nombre: lote.nombre, fecha_entrada: lote.fecha_entrada, cantidad: lote.cantidad, costo_por_cerdo: lote.costo_por_cerdo })
    setEditingId(lote.id); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setForm(EMPTY_FORM); setEditingId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    const payload = { ...form, cantidad: Number(form.cantidad), costo_por_cerdo: Number(form.costo_por_cerdo) }
    if (editingId) await update(editingId, payload)
    else await add({ id: generateId(), ...payload, estado: 'activo' })
    closeForm()
  }

  async function handleDelete(id) { await remove(id); setConfirmDelete(null) }

  if (loading) return <p className="text-slate-600 text-sm">Cargando...</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{lotes.length} lote(s) registrado(s)</p>
        <button onClick={openNew} className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg>
          Nuevo lote
        </button>
      </div>

      {lotes.length === 0 ? (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-16 text-center">
          <p className="text-slate-600 text-sm">No hay lotes registrados. Crea el primero.</p>
        </div>
      ) : (
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Nombre','Fecha entrada','Cantidad','Costo/cerdo','Total invertido','Estado',''].map((h, i) => (
                  <th key={i} className={`px-5 py-3.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider ${i >= 2 && i <= 4 ? 'text-right' : i === 5 ? 'text-center' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {lotes.map((lote) => (
                <tr key={lote.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-5 py-3.5 font-medium text-slate-200">{lote.nombre}</td>
                  <td className="px-5 py-3.5 text-slate-500">{lote.fecha_entrada}</td>
                  <td className="px-5 py-3.5 text-right text-slate-300">{lote.cantidad}</td>
                  <td className="px-5 py-3.5 text-right text-slate-300">{fmt(lote.costo_por_cerdo)}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-emerald-400">{fmt(lote.cantidad * lote.costo_por_cerdo)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold ${lote.estado === 'activo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-slate-500'}`}>
                      {lote.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(lote)} title="Editar" className="text-slate-600 hover:text-blue-400 transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M11.5 2.5a1.414 1.414 0 012 2L5 13H2v-3L11.5 2.5z"/></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(lote.id)} title="Eliminar" className="text-slate-600 hover:text-red-400 transition-colors">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><polyline points="2 4 14 4"/><path d="M12 4l-.867 9.071A1 1 0 0110.138 14H5.862a1 1 0 01-.995-.929L4 4"/><path d="M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showForm && (
        <Modal>
          <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="modal-panel bg-[#111620] rounded-2xl shadow-2xl shadow-black/40 w-full max-w-lg border border-white/[0.06]">
              <div className="px-7 pt-7 pb-5">
                <h3 className="text-base font-semibold text-white">{editingId ? 'Editar lote' : 'Nuevo lote'}</h3>
                <p className="text-sm text-slate-500 mt-1">Completa los datos del lote</p>
              </div>
              <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-5">
                <Field label="Nombre del lote">
                  <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="Ej: Lote Enero 2026" className={inputCls} />
                </Field>
                <Field label="Fecha de entrada">
                  <input type="date" name="fecha_entrada" value={form.fecha_entrada} onChange={handleChange} required className={inputCls} style={{ colorScheme: 'dark' }} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cantidad de cerdos">
                    <input type="number" name="cantidad" value={form.cantidad} onChange={handleChange} required min="1" placeholder="20" className={inputCls} />
                  </Field>
                  <Field label="Costo por cerdo ($)">
                    <input type="number" name="costo_por_cerdo" value={form.costo_por_cerdo} onChange={handleChange} required min="0" placeholder="350000" className={inputCls} />
                  </Field>
                </div>
                {form.cantidad && form.costo_por_cerdo && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-5 py-4">
                    <p className="text-xs text-slate-500 mb-1">Total inversión estimada</p>
                    <p className="text-xl font-bold text-emerald-400">{fmt(Number(form.cantidad) * Number(form.costo_por_cerdo))}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeForm} className="flex-1 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] py-3 rounded-xl text-sm font-medium transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 bg-gradient-to-r from-emerald-600 to-green-500 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110">{editingId ? 'Guardar cambios' : 'Crear lote'}</button>
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
                <p className="text-white font-semibold mb-1.5">¿Eliminar este lote?</p>
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
