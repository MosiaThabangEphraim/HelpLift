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
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Admin access required." }, { status: 403 })

    const { id } = await context.params
    const { data: donation, error } = await supabase
      .from("donations")
      .select("id, amount, payment_method, status, reference_code, bank_name, proof_storage_path, proof_uploaded_at, payer_notes, admin_notes, reviewed_at, receipt_sent_at, giver_id, organization_id, created_at, needs(title, organizations(name, profile_id)), givers(name, email, profile_id)")
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
    console.error("Admin fetch donation error:", error)
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
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Admin access required." }, { status: 403 })

    const { id } = await context.params
    const { status, admin_notes, amount } = await request.json()
    if (!["successful", "unsuccessful"].includes(status)) {
      return NextResponse.json({ message: "Invalid donation status." }, { status: 400 })
    }

    const updatePayload: Record<string, any> = {
      status,
      admin_notes: admin_notes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }
    if (amount !== undefined && amount !== null && amount !== "") {
      const numericAmount = Number(amount)
      if (!numericAmount || numericAmount <= 0) {
        return NextResponse.json({ message: "Enter a valid corrected amount greater than zero." }, { status: 400 })
      }
      updatePayload.amount = numericAmount
    }

    const { data: donation, error } = await supabase
      .from("donations")
      .update(updatePayload)
      .eq("id", id)
      .select("id, amount, reference_code, status, giver_id, organization_id, gift_offering_id, needs(title), givers(profile_id), organizations(profile_id)")
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    // A financial Gift Library pledge's listing stays hidden ('pending') until
    // its payment is confirmed — cascade the verdict onto it here so it either
    // becomes claimable (successful) or is withdrawn (unsuccessful).
    if (donation.gift_offering_id) {
      try {
        await supabase
          .from("gift_offerings")
          .update({ status: status === "successful" ? "approved" : "rejected" })
          .eq("id", donation.gift_offering_id)
          .eq("status", "pending")
      } catch (cascadeErr) {
        console.warn("Gift offering cascade warning:", cascadeErr)
      }
    }

    try {
      const needTitle = (donation as any).needs?.title || (donation as any).needs?.[0]?.title
      const subject = needTitle ? `for "${needTitle}"` : "as a Gift Library pledge"
      const giverProfileId = (donation as any).givers?.profile_id || (donation as any).givers?.[0]?.profile_id
      const orgProfileId = (donation as any).organizations?.profile_id || (donation as any).organizations?.[0]?.profile_id
      const verdict = status === "successful" ? "confirmed as successful" : "marked as unsuccessful"
      const notifications = []
      if (giverProfileId) {
        notifications.push({
          recipient_id: giverProfileId,
          sender_id: user.id,
          type: "donation_reviewed",
          title: `Donation ${verdict}`,
          message: `Your donation of R${Number(donation.amount).toFixed(2)} (ref ${donation.reference_code}) ${subject} was ${verdict}.${admin_notes ? ` Note: ${admin_notes}` : ""}`,
        })
      }
      if (orgProfileId && status === "successful") {
        notifications.push({
          recipient_id: orgProfileId,
          sender_id: user.id,
          type: "donation_received",
          title: "Donation received",
          message: `A donation of R${Number(donation.amount).toFixed(2)} (ref ${donation.reference_code}) ${subject} was confirmed.`,
        })
      }
      if (notifications.length) await supabase.from("notifications").insert(notifications)
    } catch (notifyErr) {
      console.warn("Donation review notification warning:", notifyErr)
    }

    return NextResponse.json({ donation })
  } catch (error) {
    console.error("Admin donation review error:", error)
    return NextResponse.json({ message: "Donation review is unavailable." }, { status: 503 })
  }
}
