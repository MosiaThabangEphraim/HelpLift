import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

// Submits a claim on an offering - one of possibly several at once. The
// offering itself stays 'approved' (still visible to every other org) until
// an admin approves one specific claim; the "one pending claim per org at a
// time" rule is enforced by a partial unique index on gift_claims, and the
// friendly duplicate-claim message below is just getting ahead of it.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const orgCtx = await getOrgContext<{ id: string; name: string; verification_status: string }>(supabase, user.id, "id, name, verification_status")
    const org = orgCtx?.organization ?? null

    if (!orgCtx || !org) return NextResponse.json({ message: "Organization account required." }, { status: 403 })
    if (!roleAtLeast(orgCtx.role, "manager")) return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    if (org.verification_status !== "approved") {
      return NextResponse.json({ message: "Your organization must be approved by an administrator before claiming offerings." }, { status: 403 })
    }

    const { id } = await context.params

    const contentType = request.headers.get("content-type") || ""
    let motivationRaw = ""
    let documentFiles: File[] = []
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      motivationRaw = String(formData.get("motivation") || "")
      documentFiles = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0)
    } else {
      const body = await request.json().catch(() => ({}))
      motivationRaw = typeof body.motivation === "string" ? body.motivation : ""
    }
    const motivation = motivationRaw.trim().slice(0, 1000)
    if (!motivation) {
      return NextResponse.json({ message: "Tell the admin why your organization needs this offering." }, { status: 400 })
    }

    const { data: gift, error: lookupError } = await supabase
      .from("gift_offerings")
      .select("id, status, giver_id, title")
      .eq("id", id)
      .single()

    if (lookupError || !gift) {
      return NextResponse.json({ message: "Gift offering not found." }, { status: 404 })
    }

    if (gift.status !== "approved") {
      return NextResponse.json({ message: "This offering is no longer available." }, { status: 400 })
    }

    const { data: existingPending } = await supabase
      .from("gift_claims")
      .select("id")
      .eq("gift_offering_id", id)
      .eq("organization_id", org.id)
      .eq("status", "pending")
      .maybeSingle()
    if (existingPending) {
      return NextResponse.json({ message: "Your organization already has a claim on this offering awaiting a decision." }, { status: 409 })
    }

    const { data: claim, error: claimError } = await supabase
      .from("gift_claims")
      .insert({ gift_offering_id: id, organization_id: org.id, motivation, requested_by: user.id })
      .select()
      .single()
    if (claimError) {
      // The partial unique index is the actual guarantee behind the check above.
      const message = /duplicate key|unique/i.test(claimError.message)
        ? "Your organization already has a claim on this offering awaiting a decision."
        : claimError.message
      return NextResponse.json({ message }, { status: 400 })
    }

    let documentsUploaded = 0
    for (const file of documentFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("gift-claim-documents")
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
        if (uploadError) {
          console.warn("Gift claim document upload warning:", uploadError.message)
          continue
        }
        const { error: docError } = await supabase
          .from("gift_claim_documents")
          .insert({ claim_id: claim.id, storage_path: storagePath, file_name: file.name, uploaded_by: user.id })
        if (docError) console.warn("Gift claim document record warning:", docError.message)
        else documentsUploaded++
      } catch (fileErr) {
        console.warn("Gift claim document exception:", fileErr)
      }
    }

    // Notify the giver (informational) and an admin (action required) that this
    // claim now needs review - finalized only once an admin approves it.
    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", gift.giver_id).single()
      if (giver?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: giver.profile_id,
          p_type: "gift_claim_requested",
          p_title: "Your gift offering has a claim request",
          p_message: `${org.name} would like to claim your offering "${gift.title}". A HelpLift administrator will review and confirm this claim.`,
        })
      }
      const { data: adminId } = await supabase.rpc("get_any_admin_id")
      if (adminId) {
        await supabase.rpc("send_notification", {
          p_recipient: adminId as unknown as string,
          p_type: "gift_claim_requested",
          p_title: "Gift offering claim needs approval",
          p_message: `${org.name} wants to claim "${gift.title}". Reason: ${motivation}${documentsUploaded ? ` (${documentsUploaded} supporting document${documentsUploaded === 1 ? "" : "s"} attached)` : ""}`,
        })
      }
    } catch (notifErr) {
      console.warn("Notification error during gift claim:", notifErr)
    }

    return NextResponse.json({ success: true, claim, documentsUploaded }, { status: 201 })
  } catch (err: any) {
    console.error("Claim gift exception:", err)
    return NextResponse.json({ message: "Unable to claim offering at this time." }, { status: 503 })
  }
}
