import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const C = {
  verde: '#2d6a4f',
  verdeClaro: '#d8f3dc',
  gris: '#6b7280',
  grisFondo: '#f9fafb',
  rojo: '#dc2626',
  negro: '#111827'
}

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: C.negro },
  header: { marginBottom: 16 },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.verde },
  subtitulo: { fontSize: 10, color: C.gris, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  metaItem: { fontSize: 8, color: C.gris },
  metaVal: { fontFamily: 'Helvetica-Bold', color: C.negro },
  divider: { borderBottom: `1pt solid ${C.verdeClaro}`, marginVertical: 10 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.verde, marginBottom: 6 },
  table: { width: '100%' },
  tableHead: { flexDirection: 'row', backgroundColor: C.verde, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 4 },
  tableHeadCell: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, borderBottom: `0.5pt solid #e5e7eb` },
  tableRowAlt: { backgroundColor: C.grisFondo },
  cell: { fontSize: 8 },
  empty: { fontSize: 8, color: C.gris, marginTop: 4, fontStyle: 'italic' },
  summaryBox: { flexDirection: 'row', gap: 10, marginTop: 16 },
  summaryCard: { flex: 1, borderRadius: 4, padding: 10, backgroundColor: C.grisFondo, border: `1pt solid #e5e7eb` },
  summaryLabel: { fontSize: 7.5, color: C.gris, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.gris }
})

function fmt(value) {
  return `$${Number(value).toLocaleString('es-CO')}`
}

// Columnas para pagos
const PAGO_COLS = [
  { label: 'Fecha', key: 'fecha', flex: 1.2 },
  { label: 'Proveedor', key: 'proveedor', flex: 2 },
  { label: 'Descripción', key: 'descripcion', flex: 2.5 },
  { label: 'Tipo', key: 'tipo', flex: 1 },
  { label: 'Monto', key: 'monto', flex: 1.3, align: 'right', format: fmt }
]

// Columnas para ventas
const VENTA_COLS = [
  { label: 'Fecha', key: 'fecha', flex: 1.2 },
  { label: 'Lote', key: '_lote', flex: 1.8 },
  { label: 'Cerdos', key: 'cantidad', flex: 0.8, align: 'right' },
  { label: 'Peso total', key: 'total_kg', flex: 1, align: 'right', format: (v) => `${v} kg` },
  { label: 'Precio/kg', key: 'precio_kg', flex: 1.2, align: 'right', format: fmt },
  { label: 'Total', key: 'total', flex: 1.3, align: 'right', format: fmt }
]

function Table({ columns, rows }) {
  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        {columns.map((col) => (
          <Text key={col.key} style={[s.tableHeadCell, { flex: col.flex, textAlign: col.align ?? 'left' }]}>
            {col.label}
          </Text>
        ))}
      </View>
      {rows.length === 0 && <Text style={s.empty}>Sin registros en este período.</Text>}
      {rows.map((row, i) => (
        <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          {columns.map((col) => {
            const val = row[col.key] ?? '—'
            const display = col.format ? col.format(val) : String(val)
            return (
              <Text key={col.key} style={[s.cell, { flex: col.flex, textAlign: col.align ?? 'left' }]}>
                {display}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export default function ReportePDF({ pagos, ventas, lotes, loteId, fechaDesde, fechaHasta }) {
  const loteNombre = loteId === 'todos'
    ? 'Todos los lotes'
    : lotes.find((l) => l.id === loteId)?.nombre ?? '—'

  const lotesAplicables = loteId === 'todos' ? lotes : lotes.filter((l) => l.id === loteId)
  const totalInvertido = lotesAplicables.reduce((s, l) => s + l.cantidad * l.costo_por_cerdo, 0)
  const totalPagado = pagos.reduce((s, p) => s + p.monto, 0)
  const totalVendido = ventas.reduce((s, v) => s + v.total, 0)
  const ganancia = totalVendido - totalPagado - totalInvertido

  const ventasConLote = ventas.map((v) => ({
    ...v,
    _lote: lotes.find((l) => l.id === v.lote_id)?.nombre ?? '—'
  }))

  const fechaReporte = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Encabezado */}
        <View style={s.header}>
          <Text style={s.titulo}>Farm Manager — Reporte</Text>
          <Text style={s.subtitulo}>Generado el {fechaReporte}</Text>
          <View style={s.metaRow}>
            <Text style={s.metaItem}>Período: <Text style={s.metaVal}>{fechaDesde} — {fechaHasta}</Text></Text>
            <Text style={s.metaItem}>Lote: <Text style={s.metaVal}>{loteNombre}</Text></Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Pagos */}
        <Text style={s.sectionTitle}>Pagos ({pagos.length})</Text>
        <Table columns={PAGO_COLS} rows={pagos} />

        <View style={s.divider} />

        {/* Ventas */}
        <Text style={s.sectionTitle}>Ventas ({ventas.length})</Text>
        <Table columns={VENTA_COLS} rows={ventasConLote} />

        <View style={s.divider} />

        {/* Resumen */}
        <Text style={s.sectionTitle}>Resumen</Text>
        <View style={s.summaryBox}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Inversión cerdos</Text>
            <Text style={[s.summaryValue, { color: '#d97706' }]}>{fmt(totalInvertido)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Gastos operativos</Text>
            <Text style={[s.summaryValue, { color: C.rojo }]}>{fmt(totalPagado)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Total vendido</Text>
            <Text style={[s.summaryValue, { color: C.verde }]}>{fmt(totalVendido)}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Ganancia / Pérdida</Text>
            <Text style={[s.summaryValue, { color: ganancia >= 0 ? C.verde : C.rojo }]}>
              {fmt(ganancia)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Farm Manager</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
