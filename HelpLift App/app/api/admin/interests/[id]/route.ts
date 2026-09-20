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
    const { status, reason } = await request.json()
    const cleanReason = typeof reason === "string" && reason.trim() ? reason.trim() : null
    if (!["accepted", "declined"].includes(status)) return NextResponse.json({ message: "Invalid interest status." }, { status: 400 })
    const { data: existingInterest, error: lookupError } = await supabase.from("support_interests").select("id, need_id, giver_id").eq("id", id).single()
    if (lookupError || !existingInterest) return NextResponse.json({ message: lookupError?.message || "Interest not found." }, { status: 404 })
    const { data: need, error: needError } = await supabase.from("needs").select("organization_id, status").eq("id", existingInterest.need_id).single()
    if (needError || !need) return NextResponse.json({ message: "Related need not found." }, { status: 404 })
    const { data: giver, error: giverError } = await supabase.from("givers").select("profile_id").eq("id", existingInterest.giver_id).single()
    if (giverError || !giver) return NextResponse.json({ message: "Related giver not found." }, { status: 404 })
    const { data: interest, error } = await supabase.from("support_interests").update({ status }).eq("id", id).select("id, status").single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    if (status === "accepted") {
      const { error: fulfillmentError } = await supabase.from("fulfillments").upsert({ interest_id: id, organization_id: need.organization_id, giver_id: existingInterest.giver_id, status: "pending" }, { onConflict: "interest_id" })
      if (fulfillmentError) return NextResponse.json({ message: fulfillmentError.message }, { status: 400 })

      if (need.status === "open") {
        await supabase.from("needs").update({ status: "in_progress" }).eq("id", existingInterest.need_id).eq("status", "open")
      }
    }
    await supabase.from("notifications").insert({
      recipient_id: giver.profile_id,
      sender_id: user.id,
      type: "interest_update",
      title: `Support interest ${status}`,
      message: `Your support interest was ${status} by the platform administrator.${status === "declined" && cleanReason ? ` Reason: ${cleanReason}` : ""}`,
    })
    return NextResponse.json({ interest })
  } catch (error) {
    console.error("Admin interest moderation error:", error)
    return NextResponse.json({ message: "Interest moderation is unavailable." }, { status: 503 })
  }
}
