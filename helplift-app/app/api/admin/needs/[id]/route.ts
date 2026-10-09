import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isPastDate } from "@/lib/expiry"
import { notifyNeedSupporters } from "@/lib/need-notifications"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })
    const { id } = await context.params
    const { status, rejection_reason } = await request.json()

    const { data: existing } = await supabase
      .from("needs")
      .select("id, status, due_date, organizations(verification_status)")
      .eq("id", id)
      .single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })

    // "closed" means one of two things here: declining a pending reopen
    // request (the need stays where it was), or an administrator closing a
    // live (open or in-progress) need - e.g. after a tip-off or a policy
    // problem - with an optional reason shared with the organization.
    const isReopenRequest = existing.status === "reopen_pending"
    const isLive = existing.status === "open" || existing.status === "in_progress"
    const allowedStatuses = isReopenRequest ? ["open", "closed"] : ["open", "fulfilled", "rejected", ...(isLive ? ["closed"] : [])]
    if (!allowedStatuses.includes(status)) return NextResponse.json({ message: "Invalid need status." }, { status: 400 })

    if (status === "open" && isPastDate((existing as any).due_date)) {
      return NextResponse.json({ message: "This need's due date has passed, so it can't be published. Ask the organization to set a new due date." }, { status: 400 })
    }

    if (status === "open") {
      const orgField = (existing as any)?.organizations
      const verificationStatus = Array.isArray(orgField) ? orgField[0]?.verification_status : orgField?.verification_status
      if (verificationStatus !== "approved") {
        return NextResponse.json({ message: "This need belongs to an organization that isn't approved yet. Approve the organization before publishing its needs." }, { status: 400 })
      }
    }

    const update: Record<string, any> = { status }
    if (status === "rejected") update.rejection_reason = rejection_reason || null
    if (isReopenRequest) update.reopen_reason = null

    const { data: need, error } = await supabase
      .from("needs")
      .update(update)
      .eq("id", id)
      .select("id, title, status, organizations(profile_id, name)")
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const orgField = (need as any).organizations
      const orgProfileId = Array.isArray(orgField) ? orgField[0]?.profile_id : orgField?.profile_id
      if (orgProfileId) {
        const verdict = status === "open"
          ? (isReopenRequest ? "reopened" : "approved and published")
          : status === "closed" ? (isReopenRequest ? "kept closed - the reopen request was declined" : "closed")
          : status === "rejected" ? "rejected"
          : "marked fulfilled"
        const reasonSuffix = rejection_reason ? ` Reason: ${rejection_reason}` : ""
        await supabase.from("notifications").insert({
          recipient_id: orgProfileId,
          sender_id: user.id,
          sender_name: "HelpLift Notifications",
          type: "need_status_update",
          title: `Need ${verdict}`,
          message: `Your need "${need.title}" was ${verdict} by an administrator.${reasonSuffix}`,
        })
      }
    } catch (notifyErr) {
      console.warn("Need status notification warning:", notifyErr)
    }
    if (status === "fulfilled" || (status === "closed" && !isReopenRequest)) {
      const orgField = (need as any).organizations
      const orgName = (Array.isArray(orgField) ? orgField[0]?.name : orgField?.name) || "The organization"
      await notifyNeedSupporters({ id: need.id, title: need.title }, orgName, status === "fulfilled" ? "fulfilled" : "closed_by_admin")
    }

    let notifiedGivers = 0
    if (status === "open") {
      try {
        const { data: count, error: matchError } = await supabase.rpc("notify_matching_givers", { p_need_id: id })
        if (matchError) console.warn("Need matching warning:", matchError.message)
        else notifiedGivers = typeof count === "number" ? count : 0
      } catch (matchErr) {
        console.warn("Need matching warning:", matchErr)
      }
    }

    return NextResponse.json({ need, notified_givers: notifiedGivers })
  } catch (error) {
    console.error("Admin need moderation error:", error)
    return NextResponse.json({ message: "Need moderation is unavailable." }, { status: 503 })
  }
}

// Housekeeping only - an organization can't delete a need once it's actually
// fulfilled or closed (see api/organization/needs/[id]/route.ts), since
// donations and fulfillments reference it by need_id. An administrator can,
// for the same old-records cleanup reason every other "delete" here is
// admin-only, but only once it's reached one of those same two end states -
// never a live draft/open/in_progress need, which is still the
// organization's own business.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "admin") return NextResponse.json({ message: "Administrator access required." }, { status: 403 })

    const { id } = await context.params
    const { data: existing } = await supabase.from("needs").select("id, status").eq("id", id).single()
    if (!existing) return NextResponse.json({ message: "Need not found." }, { status: 404 })
    if (existing.status !== "fulfilled" && existing.status !== "closed") {
      return NextResponse.json({ message: "Only a fulfilled or closed need can be deleted this way." }, { status: 400 })
    }

    const { error } = await supabase.from("needs").delete().eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin need delete error:", error)
    return NextResponse.json({ message: "Need deletion is unavailable." }, { status: 503 })
  }
}
