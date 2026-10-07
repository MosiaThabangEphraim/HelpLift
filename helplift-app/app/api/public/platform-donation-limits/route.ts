import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPlatformDonationLimits } from "@/lib/platform-settings"

// Public - the "Support The Platform" amount field needs to show its
// min/max before (or without) signing in, same as withdrawal limits are
// shown to an organization once logged in. platform_settings itself is
// already readable by anyone (see 20260924000100_platform_settings.sql).
export async function GET() {
  try {
    const supabase = await createClient()
    const limits = await getPlatformDonationLimits(supabase)
    return NextResponse.json({ limits })
  } catch (error) {
    console.error("Public platform donation limits error:", error)
    return NextResponse.json({ limits: { min: 20, max: null } })
  }
}
