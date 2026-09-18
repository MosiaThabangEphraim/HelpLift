import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    if (profile?.role !== "organization") return NextResponse.json({ message: "Organization access required." }, { status: 403 })
    const { data: organization } = await supabase.from("organizations").select("id").eq("profile_id", user.id).single()
    const { id } = await context.params
    const { status } = await request.json()
    if (!organization || !["accepted", "declined"].includes(status)) return NextResponse.json({ message: "Invalid interest update." }, { status: 400 })

    const { data: interest, error: lookupError } = await supabase.from("support_interests").select("id, giver_id, need_id, needs!inner(organization_id, title, status)").eq("id", id).eq("needs.organization_id", organization.id).single()
    if (lookupError || !interest) return NextResponse.json({ message: "Interest not found for this organization." }, { status: 404 })
    const { data: updated, error } = await supabase.from("support_interests").update({ status }).eq("id", id).select("id, status").single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    if (status === "accepted") {
      const { error: fulfillmentError } = await supabase.from("fulfillments").upsert({ interest_id: id, organization_id: organization.id, giver_id: interest.giver_id, status: "pending" }, { onConflict: "interest_id" })
      if (fulfillmentError) return NextResponse.json({ message: fulfillmentError.message }, { status: 400 })

      // A need moves from "open" to "in progress" once at least one giver is
      // actively working on it — distinct from the fulfillment's own status.
      const needStatus = (interest as any).needs?.status || (interest as any).needs?.[0]?.status
      if (needStatus === "open") {
        await supabase.from("needs").update({ status: "in_progress" }).eq("id", interest.need_id).eq("status", "open")
      }
    }

    try {
      const { data: giver } = await supabase.from("givers").select("profile_id").eq("id", interest.giver_id).single()
      const needTitle = (interest as any).needs?.title || (interest as any).needs?.[0]?.title || "a need"
      if (giver?.profile_id) {
        await supabase.rpc("send_notification", {
          p_recipient: giver.profile_id,
          p_type: "interest_update",
          p_title: `Your interest was ${status}`,
          p_message: `Your expression of interest in "${needTitle}" was ${status} by the organization.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Interest decision notification warning:", notifyErr)
    }

    return NextResponse.json({ interest: updated })
  } catch (error) {
    console.error("Organization interest update error:", error)
    return NextResponse.json({ message: "Interest management is unavailable." }, { status: 503 })
  }
}
