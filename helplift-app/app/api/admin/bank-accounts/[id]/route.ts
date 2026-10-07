import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ message: "Authentication required." }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: NextResponse.json({ message: "Administrator access required." }, { status: 403 }) }
  return { user }
}

const ROW_SELECT = "id, key, bank_name, account_name, account_number, branch_code, account_type, swift_code, is_active, sort_order, created_at"
const EDITABLE_FIELDS = ["bank_name", "account_name", "account_number", "branch_code", "account_type", "swift_code", "is_active", "sort_order"] as const

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const update: Record<string, any> = {}
    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue
      if (field === "is_active") { update.is_active = !!body.is_active; continue }
      if (field === "sort_order") { update.sort_order = Number(body.sort_order) || 0; continue }
      const value = typeof body[field] === "string" ? body[field].trim() : ""
      if (field !== "swift_code" && !value) return NextResponse.json({ message: `${field.replace(/_/g, " ")} can't be empty.` }, { status: 400 })
      update[field] = value || null
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ message: "No changes provided." }, { status: 400 })

    const { data: account, error } = await supabase.from("platform_bank_accounts").update(update).eq("id", id).select(ROW_SELECT).single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ account })
  } catch (error) {
    console.error("Admin bank account update error:", error)
    return NextResponse.json({ message: "Could not update this bank account." }, { status: 503 })
  }
}

// A bank account referenced by past donations shouldn't be deleted outright
// (it would orphan their history) - retire it instead (PATCH is_active:false).
// This only removes one that was never used.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const { id } = await context.params
    const { data: account } = await supabase.from("platform_bank_accounts").select("key").eq("id", id).single()
    if (!account) return NextResponse.json({ message: "Bank account not found." }, { status: 404 })

    const { count } = await supabase.from("donations").select("id", { count: "exact", head: true }).eq("bank_name", account.key)
    if ((count ?? 0) > 0) {
      return NextResponse.json({ message: "This account has donations on record and can't be deleted - retire it instead." }, { status: 400 })
    }

    const { error } = await supabase.from("platform_bank_accounts").delete().eq("id", id)
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin bank account delete error:", error)
    return NextResponse.json({ message: "Could not delete this bank account." }, { status: 503 })
  }
}
