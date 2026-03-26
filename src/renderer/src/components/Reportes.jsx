import { useState, useMemo } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useDb } from '../hooks/useDb'
import ReportePDF from './ReportePDF'

function today() { return new Date().toISOString().split('T')[0] }
function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fmt(value) {
  return Number(value).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
}

const inputCls = "w-full bg-[#080b13] border border-white/[0.08] text-slate-100 rounded-lg px-4 py-2.5 text-sm focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 outline-none transition-all"

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1.5">{sub}</p>}
    </div>
  )
}

export default function Reportes() {
  const { data: pagos,  loading: lp } = useDb('pagos')
  const { data: ventas, loading: lv } = useDb('ventas')
  const { data: lotes,  loading: ll } = useDb('lotes')

  const [fechaDesde, setFechaDesde] = useState(firstOfMonth())
  const [fechaHasta, setFechaHasta] = useState(today())
  const [loteId, setLoteId] = useState('todos')
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const pagosFiltrados = useMemo(() =>
    pagos.filter((p) => p.fecha >= fechaDesde && p.fecha <= fechaHasta && (loteId === 'todos' || p.lote_id === loteId)),
    [pagos, fechaDesde, fechaHasta, loteId]
  )

  const ventasFiltradas = useMemo(() =>
    ventas.filter((v) => v.fecha >= fechaDesde && v.fecha <= fechaHasta && (loteId === 'todos' || v.lote_id === loteId)),
    [ventas, fechaDesde, fechaHasta, loteId]
  )

  const totalPagado  = useMemo(() => pagosFiltrados.reduce((s, p) => s + p.monto, 0), [pagosFiltrados])
  const totalVendido = useMemo(() => ventasFiltradas.reduce((s, v) => s + v.total, 0), [ventasFiltradas])
  const totalInvertido = useMemo(() => {
    const lotesAplicables = loteId === 'todos' ? lotes : lotes.filter((l) => l.id === loteId)
    return lotesAplicables.reduce((s, l) => s + l.cantidad * l.costo_por_cerdo, 0)
  }, [lotes, loteId])
  const ganancia = totalVendido - totalPagado - totalInvertido
  const sinDatos = pagosFiltrados.length === 0 && ventasFiltradas.length === 0

  async function handleGenerar() {
    setGenerando(true)
    setError(null)
    setSuccess(false)
    try {
      const doc = (
        <ReportePDF
          pagos={pagosFiltrados}
          ventas={ventasFiltradas}
          lotes={lotes}
          loteId={loteId}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
        />
      )
      const blob = await pdf(doc).toBlob()
      const arrayBuffer = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)
      const saved = await window.api.pdf.guardar(base64, `reporte_${fechaDesde}_${fechaHasta}.pdf`)
      if (saved) setSuccess(true)
    } catch (err) {
      setError(err.message ?? 'Error desconocido al generar el PDF')
    } finally {
      setGenerando(false)
    }
  }

  if (lp || lv || ll) return <p className="text-slate-600 text-sm">Cargando...</p>

  return (
    <div className="max-w-3xl space-y-5">
      {/* ── Filters ── */}
      <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-6">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-4">Configurar reporte</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Desde', type: 'date', value: fechaDesde, set: setFechaDesde },
            { label: 'Hasta',  type: 'date', value: fechaHasta, set: setFechaHasta }
          ].map(({ label, type, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">{label}</label>
              <input type={type} value={value} onChange={(e) => set(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }} />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Lote</label>
            <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className={inputCls} style={{ colorScheme: 'dark' }}>
              <option value="todos">Todos los lotes</option>
              {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Inversión cerdos" value={fmt(totalInvertido)} sub={loteId === 'todos' ? `${lotes.length} lote(s)` : '1 lote'} color="text-amber-400" />
        <StatCard label="Gastos operativos" value={fmt(totalPagado)}  sub={`${pagosFiltrados.length} pago(s)`}  color="text-red-400" />
        <StatCard label="Total vendido" value={fmt(totalVendido)} sub={`${ventasFiltradas.length} venta(s)`} color="text-emerald-400" />
        <StatCard label="Ganancia / Pérdida" value={fmt(ganancia)} sub={ganancia >= 0 ? 'Balance positivo' : 'Balance negativo'} color={ganancia >= 0 ? 'text-emerald-400' : 'text-red-400'} />
      </div>

      {/* ── Preview lists ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-4">Pagos en el período</p>
          {pagosFiltrados.length === 0 ? (
            <p className="text-slate-600 text-sm">Sin pagos</p>
          ) : (
            <ul className="space-y-2.5">
              {pagosFiltrados.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 text-sm truncate">{p.descripcion || p.proveedor || '—'}</span>
                  <span className="text-red-400 text-sm font-semibold shrink-0">{fmt(p.monto)}</span>
                </li>
              ))}
              {pagosFiltrados.length > 5 && <li className="text-xs text-slate-600">+{pagosFiltrados.length - 5} más...</li>}
            </ul>
          )}
        </div>
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl p-5">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-4">Ventas en el período</p>
          {ventasFiltradas.length === 0 ? (
            <p className="text-slate-600 text-sm">Sin ventas</p>
          ) : (
            <ul className="space-y-2.5">
              {ventasFiltradas.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 text-sm">{v.fecha} · {v.cantidad} cerdo(s)</span>
                  <span className="text-emerald-400 text-sm font-semibold shrink-0">{fmt(v.total)}</span>
                </li>
              ))}
              {ventasFiltradas.length > 5 && <li className="text-xs text-slate-600">+{ventasFiltradas.length - 5} más...</li>}
            </ul>
          )}
        </div>
      </div>

      {/* ── Generate action ── */}
      <div className="space-y-3">
        <button
          onClick={handleGenerar}
          disabled={generando || sinDatos}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-green-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none text-white font-semibold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/25 hover:brightness-110"
        >
          {generando ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando PDF...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Generar y guardar PDF
            </>
          )}
        </button>
        {sinDatos && <p className="text-center text-xs text-slate-600">No hay datos en el período seleccionado</p>}
        {error && <p className="text-center text-xs text-red-400">Error: {error}</p>}
        {success && <p className="text-center text-xs text-emerald-400">PDF guardado correctamente</p>}
      </div>
    </div>
  )
}
