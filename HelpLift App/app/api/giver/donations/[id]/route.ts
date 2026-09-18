import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { id } = await context.params
    const { data: donation, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, bank_name, proof_storage_path, proof_uploaded_at, payer_notes, admin_notes, reviewed_at, giver_id, created_at, needs(title, organizations(name)), gift_offerings(title)")
      .eq("id", id)
      .single()
    if (error || !donation) return NextResponse.json({ message: "Donation not found." }, { status: 404 })

    let proofSignedUrl: string | null = null
    if (donation.proof_storage_path) {
      const { data: signed } = await supabase.storage
        .from("donation-proofs")
        .createSignedUrl(donation.proof_storage_path, 60 * 60)
      if (signed) proofSignedUrl = signed.signedUrl
    }

    const { data: proofRows } = await supabase
      .from("donation_proofs")
      .select("id, storage_path, file_name, created_at")
      .eq("donation_id", id)
      .order("created_at", { ascending: true })
    const proofs = await Promise.all(
      (proofRows || []).map(async (row) => {
        const { data: signed } = await supabase.storage.from("donation-proofs").createSignedUrl(row.storage_path, 60 * 60)
        return { id: row.id, file_name: row.file_name, url: signed?.signedUrl || null }
      })
    )

    return NextResponse.json({ donation, proofSignedUrl, proofs })
  } catch (error) {
    console.error("Fetch donation error:", error)
    return NextResponse.json({ message: "Failed to fetch donation." }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const { id } = await context.params
    const formData = await request.formData()
    const payerNotes = String(formData.get("payer_notes") || "")
    const proofFiles = formData.getAll("proofs").filter((f): f is File => f instanceof File && f.size > 0)
    // "proof" (singular) kept for older callers; new clients send "proofs".
    const legacyFile = formData.get("proof")
    if (legacyFile instanceof File && legacyFile.size > 0) proofFiles.unshift(legacyFile)
    if (proofFiles.length === 0) {
      return NextResponse.json({ message: "Upload your proof of payment to continue." }, { status: 400 })
    }

    const uploadedPaths: { path: string; name: string }[] = []
    for (const file of proofFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from("donation-proofs")
        .upload(storagePath, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })
      if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 400 })
      uploadedPaths.push({ path: storagePath, name: file.name })
    }

    for (const { path, name } of uploadedPaths) {
      const { error: proofInsertError } = await supabase.rpc("add_donation_proof", {
        p_donation_id: id,
        p_storage_path: path,
        p_file_name: name,
      })
      if (proofInsertError) console.warn("Donation proof record warning:", proofInsertError.message)
    }

    const { data: donation, error } = await supabase
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
      const adminId = await supabase.rpc("get_any_admin_id")
      if (adminId.data) {
        await supabase.from("notifications").insert({
          recipient_id: adminId.data,
          sender_id: user.id,
          type: "donation_proof_submitted",
          title: "Proof of payment submitted",
          message: `A donation of R${Number(donation.amount).toFixed(2)} (ref ${donation.reference_code}) is awaiting verification.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Donation proof notification warning:", notifyErr)
    }

    return NextResponse.json({ donation })
  } catch (error) {
    console.error("Donation proof upload error:", error)
    return NextResponse.json({ message: "Proof upload is unavailable." }, { status: 503 })
  }
}
