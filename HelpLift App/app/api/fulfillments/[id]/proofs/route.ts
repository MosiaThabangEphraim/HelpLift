import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"

const MAX_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = /\.(png|jpe?g|webp|gif|pdf)$/i

// Add more delivery proof (photos, receipts, documents) to a fulfillment after
// it has been started or completed. Owners and managers of the organization
// only; the giver is told new proof was added.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const orgCtx = await getOrgContext<{ id: string }>(supabase, user.id, "id")
    if (!orgCtx) return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    if (!roleAtLeast(orgCtx.role, "manager")) {
      return NextResponse.json({ message: insufficientRoleMessage(orgCtx.role, "manager") }, { status: 403 })
    }

    const { id } = await context.params
    const { data: fulfillment } = await supabase
      .from("fulfillments")
      .select("id, status, giver_id, support_interests(needs(title))")
      .eq("id", id)
      .eq("organization_id", orgCtx.organization.id)
      .single()
    if (!fulfillment) return NextResponse.json({ message: "Fulfillment not found." }, { status: 404 })
    if (fulfillment.status === "pending" || fulfillment.status === "cancelled") {
      return NextResponse.json({ message: "Proof can be added once delivery has started, and not on a cancelled fulfillment." }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll("proofs").filter((f): f is File => f instanceof File && f.size > 0)
    if (files.length === 0) return NextResponse.json({ message: "Choose at least one file." }, { status: 400 })
    if (files.length > MAX_FILES) return NextResponse.json({ message: `You can add up to ${MAX_FILES} files at a time.` }, { status: 400 })

    let added = 0
    const failed: string[] = []
    for (const file of files) {
      if (file.size > MAX_BYTES || !ALLOWED.test(file.name)) {
        failed.push(file.name)
        continue
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from("fulfillment-proofs")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false })
      if (uploadError) {
        console.warn("Extra fulfillment proof upload warning:", uploadError.message)
        failed.push(file.name)
        continue
      }
      const { error: rpcError } = await supabase.rpc("add_fulfillment_proof", {
        p_fulfillment_id: id,
        p_storage_path: storagePath,
        p_file_name: file.name,
      })
      if (rpcError) {
        await supabase.storage.from("fulfillment-proofs").remove([storagePath])
        failed.push(file.name)
        continue
      }
      added++
    }

    if (added === 0) {
      return NextResponse.json({ message: `Nothing was added. Files must be images or PDFs under 10 MB.${failed.length ? ` (${failed.join(", ")})` : ""}` }, { status: 400 })
    }

    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", fulfillment.giver_id).single()
      const needField = (fulfillment as any).support_interests
      const need = Array.isArray(needField) ? needField[0]?.needs : needField?.needs
      const needTitle = (Array.isArray(need) ? need[0]?.title : need?.title) || "your fulfillment"
      if (giver?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: giver.profile_id,
          p_type: "fulfillment_update",
          p_title: "New delivery proof added",
          p_message: `The organization added ${added} new proof file${added === 1 ? "" : "s"} for "${needTitle}". You can view them in your dashboard.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Extra proof notification warning:", notifyErr)
    }

    return NextResponse.json({
      added,
      failed,
      message: failed.length
        ? `Added ${added} file${added === 1 ? "" : "s"}. Couldn't add: ${failed.join(", ")} (images or PDFs under 10 MB only).`
        : `Added ${added} file${added === 1 ? "" : "s"}.`,
    }, { status: 201 })
  } catch (error) {
    console.error("Add fulfillment proof error:", error)
    return NextResponse.json({ message: "Could not add proof right now." }, { status: 503 })
  }
}
