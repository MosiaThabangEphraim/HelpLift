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

// All bank accounts, active or retired - the admin's own management list
// (the public/donor-facing list is /api/public/bank-accounts, active only).
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error
    const { data, error } = await supabase.from("platform_bank_accounts").select(ROW_SELECT).order("sort_order", { ascending: true })
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })
    return NextResponse.json({ accounts: data || [] })
  } catch (error) {
    console.error("Admin bank accounts list error:", error)
    return NextResponse.json({ message: "Bank accounts are unavailable." }, { status: 503 })
  }
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireAdmin(supabase)
    if (auth.error) return auth.error

    const body = await request.json().catch(() => ({}))
    const required = ["bank_name", "account_name", "account_number", "branch_code", "account_type"]
    for (const field of required) {
      if (typeof body[field] !== "string" || !body[field].trim()) {
        return NextResponse.json({ message: `${field.replace(/_/g, " ")} is required.` }, { status: 400 })
      }
    }

    const baseKey = slugify(body.bank_name) || "account"
    let key = baseKey
    let suffix = 2
    // Keys must be unique and stable (donations reference them) - resolve any collision here.
    while (true) {
      const { data: existing } = await supabase.from("platform_bank_accounts").select("id").eq("key", key).maybeSingle()
      if (!existing) break
      key = `${baseKey}-${suffix++}`
    }

    const { data: maxSort } = await supabase.from("platform_bank_accounts").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle()

    const { data: account, error } = await supabase
      .from("platform_bank_accounts")
      .insert({
        key,
        bank_name: body.bank_name.trim(),
        account_name: body.account_name.trim(),
        account_number: body.account_number.trim(),
        branch_code: body.branch_code.trim(),
        account_type: body.account_type.trim(),
        swift_code: typeof body.swift_code === "string" && body.swift_code.trim() ? body.swift_code.trim() : null,
        sort_order: (maxSort?.sort_order ?? 0) + 1,
      })
      .select(ROW_SELECT)
      .single()
    if (error) return NextResponse.json({ message: error.message }, { status: 400 })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error("Admin bank account create error:", error)
    return NextResponse.json({ message: "Could not add this bank account." }, { status: 503 })
  }
}
