import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/banking"

// Approves or rejects a pending withdrawal request. Approving does not send
// any money by itself - an admin still needs to actually make the EFT
// transfer and then attach proof of payment (see POST .../proof), which is
// what finally marks it "paid" / Transfer Complete.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { status, rejection_reason } = await request.json()
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Status must be approved or rejected." }, { status: 400 })
    }
    const cleanReason = typeof rejection_reason === "string" && rejection_reason.trim() ? rejection_reason.trim() : null

    const { data: current, error: currentError } = await supabase
      .from("organization_withdrawals")
      .select("id, status, amount, organizations(name, profile_id)")
      .eq("id", id)
      .single()
    if (currentError || !current) return NextResponse.json({ message: "Withdrawal request not found." }, { status: 404 })
    if (current.status !== "pending") return NextResponse.json({ message: "This request has already been reviewed." }, { status: 400 })

    const { data: withdrawal, error } = await supabase
      .from("organization_withdrawals")
      .update({
        status,
        rejection_reason: status === "rejected" ? cleanReason : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const org = (current as any).organizations
      const orgProfileId = Array.isArray(org) ? org[0]?.profile_id : org?.profile_id
      if (orgProfileId) {
        const amountLabel = formatCurrency(Number(current.amount))
        const message = status === "approved"
          ? `Your withdrawal request for ${amountLabel} was approved. Our accountant will now transfer the funds via EFT to your organization's bank account on file - this can take up to 7 working days to reflect once sent. You'll be notified again once it's complete, with proof of payment attached.`
          : `Your withdrawal request for ${amountLabel} was declined.${cleanReason ? ` Reason: ${cleanReason}` : ""}`
        await supabase.from("notifications").insert({
          recipient_id: orgProfileId,
          sender_id: user.id,
          sender_name: "HelpLift Notifications",
          type: status === "approved" ? "withdrawal_approved" : "withdrawal_rejected",
          title: status === "approved" ? "Withdrawal approved" : "Withdrawal declined",
          message,
        })
      }
    } catch (notifyErr) {
      console.warn("Withdrawal review notification warning:", notifyErr)
    }

    return NextResponse.json({ withdrawal })
  } catch (error) {
    console.error("Withdrawal review error:", error)
    return NextResponse.json({ message: "Could not update this withdrawal." }, { status: 503 })
  }
}
