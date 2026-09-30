import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrgContext, roleAtLeast, insufficientRoleMessage } from "@/lib/organization-access"
import { getWalletSummary } from "@/lib/wallet"
import { formatCurrency } from "@/lib/banking"
import { getWithdrawalLimits } from "@/lib/platform-settings"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ message: "Authentication required." }, { status: 401 })

    const ctx = await getOrgContext<{ id: string; name: string; verification_status: string }>(supabase, user.id, "id, name, verification_status")
    if (!ctx) return NextResponse.json({ message: "Organization profile not found." }, { status: 404 })
    if (!roleAtLeast(ctx.role, "owner")) return NextResponse.json({ message: insufficientRoleMessage(ctx.role, "owner") }, { status: 403 })
    if (ctx.organization.verification_status !== "approved") {
      return NextResponse.json({ message: "Your organization must be approved by an administrator before requesting a withdrawal." }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ message: "Enter a valid amount." }, { status: 400 })
    }

    const limits = await getWithdrawalLimits(supabase)
    if (amount < limits.min) {
      return NextResponse.json({ message: `The minimum withdrawal amount is ${formatCurrency(limits.min)}.` }, { status: 400 })
    }
    if (limits.max !== null && amount > limits.max) {
      return NextResponse.json({ message: `The maximum withdrawal amount is ${formatCurrency(limits.max)}.` }, { status: 400 })
    }

    const summary = await getWalletSummary(supabase, ctx.organization.id)
    if (amount > summary.availableBalance) {
      return NextResponse.json({ message: `You can withdraw up to ${formatCurrency(summary.availableBalance)}, your current available balance.` }, { status: 400 })
    }

    const { data: withdrawal, error } = await supabase
      .from("organization_withdrawals")
      .insert({ organization_id: ctx.organization.id, amount, requested_by: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    try {
      const { data: adminId } = await supabase.rpc("get_any_admin_id")
      if (adminId) {
        await supabase.rpc("send_notification", {
          p_recipient: adminId as unknown as string,
          p_type: "withdrawal_requested",
          p_title: "New withdrawal request",
          p_message: `${ctx.organization.name} requested a withdrawal of ${formatCurrency(amount)}.`,
        })
      }
    } catch (notifyErr) {
      console.warn("Withdrawal request notification warning:", notifyErr)
    }

    return NextResponse.json({ withdrawal }, { status: 201 })
  } catch (error) {
    console.error("Withdrawal request error:", error)
    return NextResponse.json({ message: "Could not submit your withdrawal request." }, { status: 503 })
  }
}
