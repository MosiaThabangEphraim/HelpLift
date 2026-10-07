import { NextResponse } from "next/server"
import { readUploadedFile, readUploadedFiles, isStagedReference } from "@/lib/staged-uploads"
import { checkUploadLimits, UPLOAD_LIMITS } from "@/lib/upload-limits"
import { createAdminClient } from "@/lib/supabase/admin"

// Lets a guest (no account, no session) attach proof of an EFT payment to
// their own platform donation, and check on its status afterwards. There is
// no session to authorize this with, so the donation's own id (an
// unguessable uuid the guest was handed right after donating) plus a
// matching email stand in for it - the same "knowledge of the receipt"
// trust model a guest checkout uses elsewhere. Everything runs on the
// service-role client, same as the authenticated equivalent
// (app/api/giver/donations/[id]/route.ts), just without add_donation_proof
// (that RPC requires auth.uid(), which a guest never has - so proof rows
// are inserted directly here instead, bypassing RLS via the service role).
async function loadGuestDonation(admin: ReturnType<typeof createAdminClient>, id: string, email: string) {
  const { data: donation } = await admin
    .from("donations")
    .select("id, amount, reference_code, status, is_platform_donation, giver_id, donor_profile_id, guest_name, guest_email")
    .eq("id", id)
    .single()
  if (!donation) return null
  if (!donation.is_platform_donation || donation.giver_id || donation.donor_profile_id) return null
  if (!donation.guest_email || donation.guest_email.toLowerCase() !== email.toLowerCase()) return null
  return donation
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const email = new URL(request.url).searchParams.get("email") || ""
    if (!email) return NextResponse.json({ message: "Email required." }, { status: 400 })

    const admin = createAdminClient()
    const donation = await loadGuestDonation(admin, id, email)
    if (!donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })

    return NextResponse.json({ donation })
  } catch (error) {
    console.error("Guest donation fetch error:", error)
    return NextResponse.json({ message: "Failed to fetch donation." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const formData = await request.formData()
    const email = String(formData.get("email") || "")
    const payerNotes = String(formData.get("payer_notes") || "")
    const proofFiles = await readUploadedFiles(formData, "proofs")
    { const uploadProblem = checkUploadLimits(proofFiles, UPLOAD_LIMITS.donationProofs); if (uploadProblem) return NextResponse.json({ message: uploadProblem }, { status: 400 }) }
    if (!email) return NextResponse.json({ message: "Email required." }, { status: 400 })
    if (proofFiles.length === 0) {
      return NextResponse.json({ message: "Upload your proof of payment to continue." }, { status: 400 })
    }

    const admin = createAdminClient()
    const donation = await loadGuestDonation(admin, id, email)
    if (!donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    if (donation.status !== "pending") {
      return NextResponse.json({ message: "This donation has already been reviewed." }, { status: 400 })
    }

    const uploadedPaths: { path: string; name: string }[] = []
    for (const file of proofFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `guest/${donation.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await admin.storage
        .from("donation-proofs")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })
      if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })
      uploadedPaths.push({ path: storagePath, name: file.name })
    }

    for (const { path, name } of uploadedPaths) {
      const { error: proofInsertError } = await admin
        .from("donation_proofs")
        .insert({ donation_id: id, storage_path: path, file_name: name })
      if (proofInsertError) console.warn("Guest donation proof record warning:", proofInsertError.message)
    }

    const { data: updated, error } = await admin
      .from("donations")
      .update({
        proof_storage_path: uploadedPaths[0].path,
        proof_uploaded_at: new Date().toISOString(),
        payer_notes: payerNotes || null,
      })
      .eq("id", id)
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const adminId = await admin.rpc("get_any_admin_id")
      if (adminId.data) {
        await admin.from("notifications").insert({
          recipient_id: adminId.data,
          sender_name: "HelpLift Notifications",
          type: "donation_proof_submitted",
          title: "Proof of payment submitted",
          message: `A guest donation of R${Number(updated.amount).toFixed(2)} (ref ${updated.reference_code}) is awaiting verification.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Guest donation proof notification warning:", notifyErr)
    }

    return NextResponse.json({ donation: updated })
  } catch (error) {
    console.error("Guest donation proof upload error:", error)
    return NextResponse.json({ message: "Proof upload is unavailable." }, { status: 503 })
  }
}
