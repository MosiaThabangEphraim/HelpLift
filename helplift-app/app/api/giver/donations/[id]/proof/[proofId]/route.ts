import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Lets whoever actually paid remove one of their own uploaded proof-of-payment
// files, while the donation is still awaiting admin review - so they can fix
// a wrong upload or drop a duplicate without waiting for a rejection first.
// Same ownership check as .../cancel (giver_id or donor_profile_id), and the
// same reasoning for using the service-role client afterward:
// prevent_donation_tamper() blocks the donor's own session from touching
// donations directly, so ownership is verified with the session client, the
// actual mutation done with the admin one.
export async function DELETE(request: Request, context: { params: Promise<{ id: string; proofId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { id, proofId } = await context.params
    const { data: donation } = await supabase.from("donations").select("id, giver_id, donor_profile_id, status").eq("id", id).single()
    if (!donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })

    let owns = false
    if (donation.giver_id) {
      const { data: giver } = await supabase.from("givers").select("id").eq("profile_id", user.id).single()
      owns = !!giver && donation.giver_id === giver.id
    } else if (donation.donor_profile_id) {
      owns = donation.donor_profile_id === user.id
    }
    if (!owns) return NextResponse.json({ message: "Donation not found." }, { status: 404 })
    if (donation.status !== "pending") {
      return NextResponse.json({ message: "This donation has already been reviewed - its proof of payment can no longer be changed." }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: proof } = await admin.from("donation_proofs").select("id, storage_path").eq("id", proofId).eq("donation_id", id).single()
    if (!proof) return NextResponse.json({ message: "Proof file not found." }, { status: 404 })

    await admin.storage.from("donation-proofs").remove([proof.storage_path])
    const { error: deleteError } = await admin.from("donation_proofs").delete().eq("id", proofId)
    if (deleteError) return NextResponse.json({ message: deleteError.message }, { status: 400 })

    // The donations table's own proof_storage_path/proof_uploaded_at are a
    // legacy single-file mirror of whichever donation_proofs row is
    // "current" - keep it pointed at whatever's left, or clear it back to
    // "awaiting proof" if that was the last one.
    const { data: remaining } = await admin
      .from("donation_proofs")
      .select("storage_path")
      .eq("donation_id", id)
      .order("created_at", { ascending: true })
    await admin
      .from("donations")
      .update({
        proof_storage_path: remaining && remaining.length > 0 ? remaining[0].storage_path : null,
        proof_uploaded_at: remaining && remaining.length > 0 ? new Date().toISOString() : null,
      })
      .eq("id", id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Donation proof delete error:", error)
    return NextResponse.json({ message: "Could not remove this proof file." }, { status: 503 })
  }
}
