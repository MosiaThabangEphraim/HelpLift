import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Guest equivalent of app/api/giver/donations/[id]/cancel - lets someone who
// donated to the platform without an account mark their own still-pending
// PayFast/PayPal donation as unsuccessful (e.g. they bounced back from
// PayFast without completing checkout). No session exists to check
// ownership with, so the donation id (an unguessable uuid handed to the
// guest right after they donated) plus a matching email stand in for it.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { email } = await request.json().catch(() => ({ email: "" }))
    if (!email) return NextResponse.json({ message: "Email required." }, { status: 400 })

    const admin = createAdminClient()
    const { data: donation } = await admin
      .from("donations")
      .select("id, status, is_platform_donation, giver_id, donor_profile_id, guest_email")
      .eq("id", id)
      .single()
    if (!donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    if (!donation.is_platform_donation || donation.giver_id || donation.donor_profile_id) {
      return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    }
    if (!donation.guest_email || donation.guest_email.toLowerCase() !== String(email).toLowerCase()) {
      return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    }
    if (donation.status !== "pending") {
      return NextResponse.json({ message: "This donation has already been reviewed and can no longer be cancelled." }, { status: 400 })
    }

    const { error } = await admin
      .from("donations")
      .update({ status: "unsuccessful", admin_notes: "Cancelled by the donor before payment was completed." })
      .eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Guest donation cancel error:", error)
    return NextResponse.json({ message: "Could not cancel this donation." }, { status: 503 })
  }
}
