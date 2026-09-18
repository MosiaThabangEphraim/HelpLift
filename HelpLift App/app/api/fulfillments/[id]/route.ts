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
    const { data: fulfillment, error } = await supabase
      .from("fulfillments")
      .select("id, status, notes, proof_storage_path, proof_notes, completed_at, organization_id, giver_id")
      .eq("id", id)
      .single()

    if (error || !fulfillment) {
      return NextResponse.json({ message: "Fulfillment record not found." }, { status: 404 })
    }

    let proofSignedUrl: string | null = null
    if (fulfillment.proof_storage_path) {
      const { data: signed } = await supabase.storage
        .from("fulfillment-proofs")
        .createSignedUrl(fulfillment.proof_storage_path, 60 * 60)
      if (signed) proofSignedUrl = signed.signedUrl
    }

    const { data: proofRows } = await supabase
      .from("fulfillment_proofs")
      .select("id, storage_path, file_name, created_at")
      .eq("fulfillment_id", id)
      .order("created_at", { ascending: true })

    const proofs = await Promise.all(
      (proofRows || []).map(async (row) => {
        const { data: signed } = await supabase.storage.from("fulfillment-proofs").createSignedUrl(row.storage_path, 60 * 60)
        return { id: row.id, fileName: row.file_name, createdAt: row.created_at, signedUrl: signed?.signedUrl || null }
      })
    )

    return NextResponse.json({ fulfillment, proofSignedUrl, proofs })
  } catch (err: any) {
    console.error("Fetch fulfillment error:", err)
    return NextResponse.json({ message: "Failed to fetch fulfillment." }, { status: 500 })
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
    if (!profile || !["giver", "organization", "admin"].includes(profile.role)) {
      return NextResponse.json({ message: "Access denied." }, { status: 403 })
    }

    const { id } = await context.params
    const contentType = request.headers.get("content-type") || ""

    let status = ""
    let notes = ""
    let proofFiles: File[] = []

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      status = String(formData.get("status") || "")
      notes = String(formData.get("notes") || "")
      proofFiles = formData.getAll("proofs").filter((f): f is File => f instanceof File && f.size > 0)
    } else {
      const body = await request.json()
      status = body.status
      notes = body.notes || ""
    }

    if (!["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ message: "Invalid fulfillment status." }, { status: 400 })
    }

    const uploadedPaths: { path: string; name: string }[] = []
    for (const file of proofFiles) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from("fulfillment-proofs")
          .upload(storagePath, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          })
        if (!uploadError) {
          uploadedPaths.push({ path: storagePath, name: file.name })
        } else {
          console.warn("Fulfillment proof upload warning:", uploadError.message)
        }
      } catch (uploadErr) {
        console.warn("Storage upload exception:", uploadErr)
      }
    }

    const primaryProofPath = uploadedPaths[0]?.path || null
    const isCompleted = status === "completed"
    const nowIso = new Date().toISOString()

    // Full payload with proof attributes
    const fullPayload: Record<string, any> = {
      status,
      notes: notes || null,
      completed_at: isCompleted ? nowIso : null,
      ...(primaryProofPath ? { proof_storage_path: primaryProofPath, proof_notes: notes || null, verified_at: nowIso } : {}),
    }

    let { data: fulfillment, error } = await supabase
      .from("fulfillments")
      .update(fullPayload)
      .eq("id", id)
      .select("id, status, notes, proof_storage_path, giver_id, organization_id, support_interests(needs(title))")
      .single()

    // Defensive fallback if proof_storage_path column doesn't exist yet in Supabase
    if (error && (error.message?.includes("proof_") || error.message?.includes("verified_at"))) {
      const fallbackPayload = {
        status,
        notes: notes || null,
        completed_at: isCompleted ? nowIso : null,
      }
      const retry = await supabase
        .from("fulfillments")
        .update(fallbackPayload)
        .eq("id", id)
        .select("id, status, notes, proof_storage_path, giver_id, organization_id, support_interests(needs(title))")
        .single()
      fulfillment = retry.data
      error = retry.error
    }

    if (error || !fulfillment) return NextResponse.json({ message: error?.message || "Fulfillment update failed." }, { status: 400 })

    // Record every uploaded file (not just the primary one kept on the
    // fulfillment row itself) so the detail view can show a full gallery.
    for (const uploaded of uploadedPaths) {
      try {
        await supabase.rpc("add_fulfillment_proof", {
          p_fulfillment_id: id,
          p_storage_path: uploaded.path,
          p_file_name: uploaded.name,
        })
      } catch (proofErr) {
        console.warn("add_fulfillment_proof warning:", proofErr)
      }
    }

    // Notify whichever side did NOT make this change.
    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", fulfillment.giver_id).single()
      const { data: org } = await supabase.from("organizations").select("profile_id, name").eq("id", fulfillment.organization_id).single()
      const needTitle = (fulfillment as any).support_interests?.needs?.title
        || (fulfillment as any).support_interests?.[0]?.needs?.title
        || (fulfillment as any).support_interests?.[0]?.needs?.[0]?.title
        || "a fulfillment"
      const actingAsGiver = giver?.profile_id === user.id
      const actingAsOrg = org?.profile_id === user.id
      const verdict = uploadedPaths.length ? "delivery proof was uploaded for" : `was updated to "${status.replace("_", " ")}" for`

      if (actingAsGiver && org?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: org.profile_id,
          p_type: "fulfillment_update",
          p_title: "Fulfillment updated",
          p_message: `A fulfillment ${verdict} "${needTitle}".`,
        })
      } else if (actingAsOrg && giver?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: giver.profile_id,
          p_type: "fulfillment_update",
          p_title: "Fulfillment updated",
          p_message: `${org?.name || "The organization"} ${uploadedPaths.length ? "uploaded delivery verification for" : `updated your fulfillment to "${status.replace("_", " ")}" for`} "${needTitle}".`,
        })
      }
    } catch (notifyErr) {
      console.warn("Fulfillment update notification warning:", notifyErr)
    }

    return NextResponse.json({ fulfillment, proof_uploaded: uploadedPaths.length > 0 })
  } catch (error) {
    console.error("Fulfillment update error:", error)
    return NextResponse.json({ message: "Fulfillment update is unavailable." }, { status: 503 })
  }
}
