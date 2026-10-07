import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getActiveBankAccounts } from "@/lib/bank-accounts"

// HelpLift's own receiving bank accounts, for the donation payment screens.
// Public: an anonymous visitor previewing a need's donate flow needs this too.
export async function GET() {
  try {
    const supabase = await createClient()
    const accounts = await getActiveBankAccounts(supabase)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Public bank accounts error:", error)
    return NextResponse.json({ accounts: [] })
  }
}
