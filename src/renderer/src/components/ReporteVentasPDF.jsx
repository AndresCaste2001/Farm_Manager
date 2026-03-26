import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const C = {
  verde: '#2d6a4f',
  verdeClaro: '#d8f3dc',
  gris: '#6b7280',
  grisFondo: '#f9fafb',
  negro: '#111827'
}

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: C.negro },
  titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.verde },
  subtitulo: { fontSize: 10, color: C.gris, marginTop: 2 },
  metaRow: { flexDirection: 'row', marginTop: 6 },
  metaItem: { fontSize: 8, color: C.gris, marginRight: 20 },
  metaVal: { fontFamily: 'Helvetica-Bold', color: C.negro },
  divider: { borderBottom: `1pt solid ${C.verdeClaro}`, marginVertical: 12 },
  ventaCard: { marginBottom: 10, border: `1pt solid #e5e7eb`, borderRadius: 4, padding: 10 },
  ventaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ventaHeaderLeft: { flexDirection: 'row' },
  metaChip: { fontSize: 8, color: C.gris, marginRight: 16 },
  metaChipVal: { fontFamily: 'Helvetica-Bold', color: C.negro },
  totalChip: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.verde },
  pesosLabel: { fontSize: 7.5, color: C.gris, marginBottom: 5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  pesosRow: { flexDirection: 'row', flexWrap: 'wrap' },
  pesoBadge: { backgroundColor: C.grisFondo, border: `1pt solid #e5e7eb`, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 6, marginRight: 4, marginBottom: 4, minWidth: 36, alignItems: 'center' },
  pesoNum: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.negro },
  summaryBox: { flexDirection: 'row', marginTop: 4 },
  summaryCard: { flex: 1, borderRadius: 4, padding: 10, backgroundColor: C.grisFondo, border: `1pt solid #e5e7eb`, marginRight: 8 },
  summaryLabel: { fontSize: 7.5, color: C.gris, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: C.gris },
  emptyText: { fontSize: 9, color: C.gris, fontStyle: 'italic', marginTop: 8 }
})

function fmt(value) {
  return `$${Number(value).toLocaleString('es-CO')}`
}

export default function ReporteVentasPDF({ ventas, lotes, loteId }) {
  const loteNombre = loteId === 'todos'
    ? 'Todos los lotes'
    : lotes.find((l) => l.id === loteId)?.nombre ?? '—'

  const fechaReporte = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const totalCerdos = ventas.reduce((s, v) => s + v.cantidad, 0)
  const totalKg = ventas.reduce((s, v) => s + v.total_kg, 0)
  const totalCOP = ventas.reduce((s, v) => s + v.total, 0)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <Text style={s.titulo}>Reporte de Ventas</Text>
        <Text style={s.subtitulo}>Generado el {fechaReporte}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaItem}>Lote: <Text style={s.metaVal}>{loteNombre}</Text></Text>
          <Text style={s.metaItem}>Total ventas: <Text style={s.metaVal}>{ventas.length}</Text></Text>
        </View>

        <View style={s.divider} />

        {/* Ventas */}
        {ventas.length === 0 ? (
          <Text style={s.emptyText}>No hay ventas para mostrar.</Text>
        ) : (
          ventas.map((venta, i) => {
            const lote = lotes.find((l) => l.id === venta.lote_id)
            const pesos = venta.pesos_kg ?? []
            return (
              <View key={venta.id} style={s.ventaCard} wrap={false}>
                <View style={s.ventaHeader}>
                  <View style={s.ventaHeaderLeft}>
                    <Text style={s.metaChip}>Fecha: <Text style={s.metaChipVal}>{venta.fecha}</Text></Text>
                    <Text style={s.metaChip}>Lote: <Text style={s.metaChipVal}>{lote?.nombre ?? '—'}</Text></Text>
                    <Text style={s.metaChip}>Cerdos: <Text style={s.metaChipVal}>{venta.cantidad}</Text></Text>
                    <Text style={s.metaChip}>Peso total: <Text style={s.metaChipVal}>{venta.total_kg} kg</Text></Text>
                    <Text style={s.metaChip}>Precio/kg: <Text style={s.metaChipVal}>{fmt(venta.precio_kg)}</Text></Text>
                  </View>
                  <Text style={s.totalChip}>{fmt(venta.total)}</Text>
                </View>
                {pesos.length > 0 && (
                  <>
                    <Text style={s.pesosLabel}>Pesos individuales</Text>
                    <View style={s.pesosRow}>
                      {pesos.map((peso, j) => (
                        <View key={j} style={s.pesoBadge}>
                          <Text style={s.pesoNum}>{peso} kg</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )
          })
        )}

        <View style={s.divider} />

        {/* Summary */}
        <View style={s.summaryBox}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Total cerdos vendidos</Text>
            <Text style={[s.summaryValue, { color: C.negro }]}>{totalCerdos}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Total kg</Text>
            <Text style={[s.summaryValue, { color: C.negro }]}>{totalKg.toFixed(1)} kg</Text>
          </View>
          <View style={[s.summaryCard, { marginRight: 0 }]}>
            <Text style={s.summaryLabel}>Total ingresos</Text>
            <Text style={[s.summaryValue, { color: C.verde }]}>{fmt(totalCOP)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Farm Manager — Reporte de Ventas</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
