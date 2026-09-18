import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/mailer"
import { generateReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf"

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  eft: "Bank Transfer (EFT)",
  payfast: "PayFast",
}

async function loadReceiptData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<{ data: ReceiptData; giverEmail: string; referenceCode: string } | { error: string; status: number }> {
  const { data: donation, error } = await supabase
    .from("donations")
    .select("id, amount, payment_method, status, reference_code, reviewed_at, created_at, needs(title), gift_offerings(title), organizations(name), givers(name, email)")
    .eq("id", id)
    .single()
  if (error || !donation) return { error: "Donation not found.", status: 404 }
  if (donation.status !== "successful") {
    return { error: "A receipt is only available for a successful donation.", status: 400 }
  }

  const giver = Array.isArray(donation.givers) ? donation.givers[0] : donation.givers
  if (!giver?.email) return { error: "This donor has no email address on file.", status: 400 }

  const org = Array.isArray(donation.organizations) ? donation.organizations[0] : donation.organizations
  const need = Array.isArray(donation.needs) ? donation.needs[0] : donation.needs
  const gift = Array.isArray(donation.gift_offerings) ? donation.gift_offerings[0] : donation.gift_offerings
  const description = need?.title || (gift?.title ? `Gift Library pledge — ${gift.title}` : "General donation")

  const confirmedAt = new Date(donation.reviewed_at || donation.created_at).toLocaleDateString("en-ZA", {
    year: "numeric", month: "long", day: "numeric",
  })

  return {
    data: {
      referenceCode: donation.reference_code,
      amount: Number(donation.amount),
      paymentMethod: PAYMENT_METHOD_LABELS[donation.payment_method] || donation.payment_method,
      confirmedAt,
      giverName: giver.name,
      giverEmail: giver.email,
      orgName: org?.name || null,
      description,
    },
    giverEmail: giver.email,
    referenceCode: donation.reference_code,
  }
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Authentication required.", status: 401 } as const
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Administrator access required.", status: 403 } as const
  return { user }
}

// Lets an admin preview/download the same PDF that "send" would email, without
// sending anything — opened directly in a new tab from the donation dialog.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { id } = await context.params
    const result = await loadReceiptData(supabase, id)
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status })

    const pdfBuffer = await generateReceiptPdf(result.data)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="HelpLift-Receipt-${result.referenceCode}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Preview donation receipt error:", error)
    return NextResponse.json({ message: "Unable to generate the receipt right now." }, { status: 503 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { id } = await context.params
    const result = await loadReceiptData(supabase, id)
    if ("error" in result) return NextResponse.json({ message: result.error }, { status: result.status })

    const pdfBuffer = await generateReceiptPdf(result.data)

    await sendEmail({
      to: result.giverEmail,
      subject: `Your HelpLift donation receipt (${result.referenceCode})`,
      text: `Hi ${result.data.giverName},\n\nThank you for your donation of R${result.data.amount.toFixed(2)} (ref ${result.referenceCode}). Your receipt is attached as a PDF.\n\n— The HelpLift team`,
      html: `
        <p>Hi ${result.data.giverName},</p>
        <p>Thank you for your donation — your receipt is attached as a PDF.</p>
        <p><strong>Reference:</strong> ${result.referenceCode}</p>
        <p>— The HelpLift team</p>
      `,
      attachments: [{ name: `HelpLift-Receipt-${result.referenceCode}.pdf`, content: pdfBuffer.toString("base64") }],
    })

    const sentAt = new Date().toISOString()
    await supabase.from("donations").update({ receipt_sent_at: sentAt }).eq("id", id)

    return NextResponse.json({ success: true, receipt_sent_at: sentAt })
  } catch (error) {
    console.error("Send donation receipt error:", error)
    return NextResponse.json({ message: "Unable to send the receipt right now." }, { status: 503 })
  }
}
