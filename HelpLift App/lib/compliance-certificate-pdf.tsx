import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer"

export type ComplianceCertificateData = {
  orgName: string
  orgType: string
  registrationNumber: string | null
  address: string | null
  city: string | null
  province: string | null
  issuedAt: string
}

const styles = StyleSheet.create({
  page: { padding: 56, fontSize: 11, fontFamily: "Helvetica", color: "#1e293b" },
  border: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, borderWidth: 2, borderColor: "#0f172a" },
  header: { alignItems: "center", marginTop: 20, marginBottom: 8 },
  brand: { fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: 1 },
  slogan: { fontSize: 9, fontStyle: "italic", color: "#475569", marginTop: 4, textAlign: "center" },
  brandSub: { fontSize: 9, color: "#64748b", marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginVertical: 24, marginHorizontal: 60 },
  title: { fontSize: 20, fontWeight: 700, color: "#0f172a", textAlign: "center", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 8 },
  subtitle: { fontSize: 10, color: "#64748b", textAlign: "center", marginTop: 6 },
  body: { fontSize: 12, lineHeight: 1.7, color: "#334155", textAlign: "center", marginTop: 28, marginHorizontal: 40 },
  orgName: { fontSize: 22, fontWeight: 700, color: "#0f172a", textAlign: "center", marginTop: 14 },
  detailsBlock: { marginTop: 28, marginHorizontal: 90, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailLabel: { fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 10, color: "#0f172a", fontWeight: 700 },
  footer: { position: "absolute", bottom: 44, left: 56, right: 56, alignItems: "center" },
  footerDate: { fontSize: 10, color: "#334155", fontWeight: 700 },
  footerText: { fontSize: 8, color: "#94a3b8", marginTop: 6, textAlign: "center", lineHeight: 1.5 },
})

function ComplianceCertificateDocument({ data }: { data: ComplianceCertificateData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border} />

        <View style={styles.header}>
          <Text style={styles.brand}>HelpLift</Text>
          <Text style={styles.slogan}>Giving made transparent. Impact made real.</Text>
          <Text style={styles.brandSub}>helplift.co.za · helplift_platform@yahoo.com</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.title}>Certificate of Compliance</Text>
        <Text style={styles.subtitle}>This certifies that the organization named below</Text>
        <Text style={styles.orgName}>{data.orgName}</Text>

        <Text style={styles.body}>
          is a verified organization on the HelpLift platform, having satisfied HelpLift's organization
          verification requirements, and is in good standing and compliant with HelpLift's platform
          policies as of the date of issue below.
        </Text>

        <View style={styles.detailsBlock}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Organization type</Text>
            <Text style={styles.detailValue}>{data.orgType}</Text>
          </View>
          {data.registrationNumber && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registration number</Text>
              <Text style={styles.detailValue}>{data.registrationNumber}</Text>
            </View>
          )}
          {(data.city || data.province) && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{[data.city, data.province].filter(Boolean).join(", ")}</Text>
            </View>
          )}
          {data.address && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Registered address</Text>
              <Text style={styles.detailValue}>{data.address}</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerDate}>Issued {data.issuedAt}</Text>
          <Text style={styles.footerText}>
            This certificate reflects this organization's verification status on the HelpLift platform as of the
            date above - it is not a government or statutory compliance certificate, and does not replace any
            registration, tax or regulatory documentation the organization holds independently of HelpLift.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateComplianceCertificatePdf(data: ComplianceCertificateData): Promise<Buffer> {
  return renderToBuffer(<ComplianceCertificateDocument data={data} />)
}
