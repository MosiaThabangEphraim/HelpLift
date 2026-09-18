"use client"

import { usePathname } from "next/navigation"
import PublicNavbar from "@/components/public-navbar"

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const pathnameLower = pathname.toLowerCase()

  const isDashboardPage =
    pathnameLower.startsWith("/dashboard") ||
    pathnameLower.startsWith("/givers-dashboard") ||
    pathnameLower.startsWith("/organisation-dashboard") ||
    pathnameLower.startsWith("/admin-dashboard")

  // The home page ("/") builds its own complete floating nav (logo, section
  // links, Sign In) directly in app/page.tsx. Rendering the global
  // PublicNavbar on top of it stacked two navbars on the home page, with the
  // home page's pill nav visually covering and blocking the global navbar's
  // Log In / Register buttons underneath.
  const hasOwnNavbar = pathname === "/"

  if (isDashboardPage || hasOwnNavbar) {
    return <>{children}</>
  }

  return (
    <>
      <PublicNavbar />
      {children}
    </>
  )
}