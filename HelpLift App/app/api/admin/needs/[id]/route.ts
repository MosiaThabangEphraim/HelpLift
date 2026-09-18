import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })
    const { id } = await context.params
    const { status, rejection_reason } = await request.json()
    if (!["open", "fulfilled", "closed", "rejected"].includes(status)) return NextResponse.json({ message: "Invalid need status." }, { status: 400 })

    if (status === "open") {
      const { data: existing } = await supabase
        .from("needs")
        .select("id, organizations(verification_status)")
        .eq("id", id)
        .single()
      const orgField = (existing as any)?.organizations
      const verificationStatus = Array.isArray(orgField) ? orgField[0]?.verification_status : orgField?.verification_status
      if (verificationStatus !== "approved") {
        return NextResponse.json({ message: "This need belongs to an organization that isn't approved yet. Approve the organization before publishing its needs." }, { status: 400 })
      }
    }

    const update: Record<string, any> = { status }
    if (status === "rejected") update.rejection_reason = rejection_reason || null

    const { data: need, error } = await supabase
      .from("needs")
      .update(update)
      .eq("id", id)
      .select("id, title, status, organizations(profile_id)")
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const orgField = (need as any).organizations
      const orgProfileId = Array.isArray(orgField) ? orgField[0]?.profile_id : orgField?.profile_id
      if (orgProfileId) {
        const verdict = status === "open" ? "approved and published" : status === "closed" ? "closed" : status === "rejected" ? "rejected" : "marked fulfilled"
        const reasonSuffix = status === "rejected" && rejection_reason ? ` Reason: ${rejection_reason}` : ""
        await supabase.from("notifications").insert({
          recipient_id: orgProfileId,
          sender_id: user.id,
          type: "need_status_update",
          title: `Need ${verdict}`,
          message: `Your need "${need.title}" was ${verdict} by an administrator.${reasonSuffix}`,
        })
      }
    } catch (notifyErr) {
      console.warn("Need status notification warning:", notifyErr)
    }

    return NextResponse.json({ need })
  } catch (error) {
    console.error("Admin need moderation error:", error)
    return NextResponse.json({ message: "Need moderation is unavailable." }, { status: 503 })
  }
}
