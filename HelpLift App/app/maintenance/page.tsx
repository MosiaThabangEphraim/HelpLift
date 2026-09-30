import Link from "next/link"
import { Wrench } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { getMaintenanceMode } from "@/lib/platform-settings"

export const metadata = {
  title: "Under maintenance - HelpLift",
}

// Shown to everyone except a signed-in admin while Platform Settings >
// Maintenance mode is on (see proxy.ts, which redirects here). An admin can
// still sign in at /admin-login and turn it back off from the dashboard.
export default async function MaintenancePage() {
  const supabase = await createClient()
  const { message } = await getMaintenanceMode(supabase)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-slate-950 px-4 text-center">
      <div className="w-full max-w-md space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400">
          <Wrench className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">We'll be right back</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        <Link href="/admin-login" className="inline-block text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          Administrator sign in
        </Link>
      </div>
    </main>
  )
}
