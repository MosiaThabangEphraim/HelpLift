import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateReceiptPdf } from "@/lib/receipt-pdf"
import { loadReceiptData, sendDonationReceipt } from "@/lib/donation-receipt"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Authentication required.", status: 401 } as const
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Administrator access required.", status: 403 } as const
  return { user }
}

// Lets an admin preview/download the same PDF that "send" would email, without
// sending anything - opened directly in a new tab from the donation dialog.
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

// Manual send/resend - receipts are now also sent automatically the moment a
// donation is confirmed successful (EFT: admin approval; PayFast: its ITN),
// but an admin can still trigger this any time, e.g. the donor says they
// never got it.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if ("error" in auth) return NextResponse.json({ message: auth.error }, { status: auth.status })

    const { id } = await context.params
    const result = await sendDonationReceipt(supabase, id)
    if (!result.success) return NextResponse.json({ message: result.message || "Unable to send the receipt right now." }, { status: 400 })

    return NextResponse.json({ success: true, receipt_sent_at: result.receipt_sent_at })
  } catch (error) {
    console.error("Send donation receipt error:", error)
    return NextResponse.json({ message: "Unable to send the receipt right now." }, { status: 503 })
  }
}
