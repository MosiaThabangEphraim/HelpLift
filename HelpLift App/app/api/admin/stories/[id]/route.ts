import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Approve (publish) or reject an impact story. A rejection may carry an
// optional reason, which is sent to the organization in a notification.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { status, reason } = await request.json().catch(() => ({}))
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ message: "Status must be approved or rejected." }, { status: 400 })
    }
    const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim() : null

    const { data: story, error } = await supabase
      .from("impact_stories")
      .update({ status, rejection_reason: status === "rejected" ? cleanReason : null })
      .eq("id", id)
      .select("id, title, status, organizations(profile_id)")
      .single()
    if (error || !story) return NextResponse.json({ message: error?.message || "Story not found." }, { status: 400 })

    try {
      const orgField = (story as any).organizations
      const orgProfileId = Array.isArray(orgField) ? orgField[0]?.profile_id : orgField?.profile_id
      if (orgProfileId) {
        await supabase.from("notifications").insert({
          recipient_id: orgProfileId,
          sender_id: user.id,
          type: "impact_story_review",
          title: status === "approved" ? "Impact story published" : "Impact story rejected",
          message: status === "approved"
            ? `Your impact story "${story.title}" was approved and is now public.`
            : `Your impact story "${story.title}" was rejected by an administrator.${cleanReason ? ` Reason: ${cleanReason}` : ""} You can edit it and it will be reviewed again.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Story review notification warning:", notifyErr)
    }

    return NextResponse.json({ story })
  } catch (error) {
    console.error("Admin story review error:", error)
    return NextResponse.json({ message: "Story review is unavailable." }, { status: 503 })
  }
}
