import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"

export type ReceiptData = {
  referenceCode: string
  amount: number
  paymentMethod: string
  confirmedAt: string
  giverName: string
  giverEmail: string
  orgName: string | null
  description: string
}

function formatCurrency(amount: number) {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  brand: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  brandSub: { fontSize: 9, color: "#64748b", marginTop: 2 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 16, fontWeight: 700, color: "#0f172a" },
  refLine: { fontSize: 9, color: "#64748b", marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 20 },
  row: { flexDirection: "row", marginBottom: 14 },
  col: { flex: 1 },
  label: { fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  value: { fontSize: 11, color: "#0f172a" },
  amountBlock: { backgroundColor: "#f8fafc", borderRadius: 8, padding: 16, marginTop: 8, marginBottom: 20 },
  amountLabel: { fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  amountValue: { fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 4 },
  thanks: { fontSize: 11, lineHeight: 1.5, color: "#334155", marginBottom: 24 },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12 },
  footerText: { fontSize: 8, color: "#94a3b8", lineHeight: 1.5 },
})

function ReceiptDocument({ data }: { data: ReceiptData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>HelpLift</Text>
            <Text style={styles.brandSub}>HelpLift · helplift.co.za</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Donation Receipt</Text>
            <Text style={styles.refLine}>Reference {data.referenceCode}</Text>
            <Text style={styles.refLine}>{data.confirmedAt}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Received from</Text>
            <Text style={styles.value}>{data.giverName}</Text>
            <Text style={styles.value}>{data.giverEmail}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Payment method</Text>
            <Text style={styles.value}>{data.paymentMethod}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>For</Text>
            <Text style={styles.value}>{data.description}</Text>
          </View>
          {data.orgName && (
            <View style={styles.col}>
              <Text style={styles.label}>Organization</Text>
              <Text style={styles.value}>{data.orgName}</Text>
            </View>
          )}
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Amount received</Text>
          <Text style={styles.amountValue}>{formatCurrency(data.amount)}</Text>
        </View>

        <Text style={styles.thanks}>
          Thank you for your generosity. This receipt confirms that HelpLift received the above donation on
          behalf of {data.orgName || "the listed organization"} and that it has been processed successfully.
        </Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This receipt confirms payment received through the HelpLift platform. It is not, by itself, a Section
            18A tax-deductibility certificate — where the receiving organization holds Section 18A status, they may
            issue that certificate separately. Please retain this receipt for your records.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument data={data} />)
}
