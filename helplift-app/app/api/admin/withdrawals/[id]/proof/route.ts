import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/banking"
import { sendEmail } from "@/lib/mailer"

// The last step: once the accountant has actually sent the EFT, an admin
// attaches proof of payment here, which marks the request "paid" (shown to
// the organization as "Transfer Complete") and notifies them with the proof.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { data: current, error: currentError } = await supabase
      .from("organization_withdrawals")
      .select("id, status, amount, organizations(name, profile_id)")
      .eq("id", id)
      .single()
    if (currentError || !current) return NextResponse.json({ message: "Withdrawal request not found." }, { status: 404 })
    if (current.status !== "approved") {
      return NextResponse.json({ message: "Proof of payment can only be attached to an approved withdrawal." }, { status: 400 })
    }

    const formData = await request.formData()
    const file = await readUploadedFile(formData, "file")
    { const uploadProblem = checkUploadLimits(file ? [file] : [], UPLOAD_LIMITS.withdrawalProof); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ message: "Attach a proof of payment file." }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${user.id}/${id}-${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("withdrawal-proofs")
      .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
    if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })

    const paidAt = new Date().toISOString()
    const { data: withdrawal, error } = await supabase
      .from("organization_withdrawals")
      .update({ status: "paid", proof_storage_path: storagePath, proof_file_name: file.name, paid_at: paidAt })
      .eq("id", id)
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    let orgProfileId: string | null = null
    try {
      const org = (current as any).organizations
      orgProfileId = Array.isArray(org) ? org[0]?.profile_id : org?.profile_id
      if (orgProfileId) {
        // This insert also triggers the generic notification-email webhook
        // (in-app bell + a short text email) - see api/webhooks/notification-created.
        await supabase.from("notifications").insert({
          recipient_id: orgProfileId,
          sender_id: user.id,
          sender_name: "HelpLift Notifications",
          type: "withdrawal_paid",
          title: "Transfer complete",
          message: `Your withdrawal of ${formatCurrency(Number(current.amount))} has been sent by EFT - proof of payment is attached. Bank transfers can take up to 7 working days to reflect in your account.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Withdrawal paid notification warning:", notifyErr)
    }

    // The generic notification email above can't carry an attachment, so the
    // actual proof-of-payment file is emailed separately here - same pattern
    // as donation receipts (a dedicated email on top of the generic
    // notification). Never lets a failure here turn a successful proof
    // upload into an error.
    try {
      if (orgProfileId) {
        const { data: orgProfile } = await supabase.from("profiles").select("email").eq("id", orgProfileId).single()
        if (orgProfile?.email) {
          const fileBuffer = Buffer.from(await file.arrayBuffer())
          const amountLabel = formatCurrency(Number(current.amount))
          await sendEmail({
            to: orgProfile.email,
            subject: `Proof of payment - your HelpLift withdrawal of ${amountLabel}`,
            text: `Hi,\n\nYour withdrawal of ${amountLabel} has been transferred by EFT. Proof of payment is attached.\n\nBank transfers can take up to 7 working days to reflect in your account.\n\n- The HelpLift team`,
            html: `
              <p>Hi,</p>
              <p>Your withdrawal of <strong>${amountLabel}</strong> has been transferred by EFT. Proof of payment is attached.</p>
              <p>Bank transfers can take up to 7 working days to reflect in your account.</p>
              <p>- The HelpLift team</p>
            `,
            attachments: [{ name: file.name, content: fileBuffer.toString("base64") }],
          })
        }
      }
    } catch (emailErr) {
      console.warn("Withdrawal proof email warning:", emailErr)
    }

    return NextResponse.json({ withdrawal })
  } catch (error) {
    console.error("Withdrawal proof upload error:", error)
    return NextResponse.json({ message: "Could not attach proof of payment." }, { status: 503 })
  }
}
