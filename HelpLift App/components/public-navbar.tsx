"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Info,
  LogIn,
  UserPlus,
  Home,
  ChevronLeft,
  ShieldCheck,
  HeartHandshake,
  Gift,
  Building2,
  Contrast,
  Moon,
  Palette,
  Sun,
  LayoutDashboard,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const DASHBOARD_PATH: Record<string, string> = {
  giver: "/givers-dashboard",
  organization: "/organisation-dashboard",
  admin: "/admin-dashboard",
}

// Same light → dark → high-contrast → grayscale cycle as
// components/theme-toggle.tsx - see that file's comment for why this navbar
// keeps its own copy of the control instead of just rendering the shared one.
type ThemeMode = "light" | "dark" | "high-contrast" | "grayscale"
const NEXT_THEME: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "high-contrast", "high-contrast": "grayscale", grayscale: "light" }
const THEME_LABEL: Record<ThemeMode, string> = {
  light: "Switch to dark mode",
  dark: "Switch to high-contrast mode",
  "high-contrast": "Switch to grayscale mode",
  grayscale: "Switch to light mode",
}

export default function PublicNavbar() {
  const router = useRouter()
  const pathname = usePathname()

  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  // Signed-in state for this shared navbar - shown on /needs, /gift-library,
  // /organizations, etc. Someone browsing those while already signed in
  // otherwise saw "Log In" / "Register" with no indication they're already
  // in - a link straight back to their dashboard instead.
  const [dashboardPath, setDashboardPath] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role) setDashboardPath(DASHBOARD_PATH[profile.role] || null)
    })
  }, [])

  const pathnameLower = pathname.toLowerCase()

  const themeMode: ThemeMode = !mounted ? "dark" : ((resolvedTheme || theme) as ThemeMode) || "light"
  const isDarkMode = themeMode === "dark" // kept for the rest of this file's existing checks

  // Do not show the public navbar on any dashboard page
  const isDashboardPage =
    pathnameLower.startsWith("/dashboard") ||
    pathnameLower.startsWith("/givers-dashboard") ||
    pathnameLower.startsWith("/organisation-dashboard") ||
    pathnameLower.startsWith("/admin-dashboard")

  if (isDashboardPage) {
    return null
  }

  const toggleDarkMode = () => {
    setTheme(NEXT_THEME[themeMode])
  }

  const handleLoginRedirect = () => router.push("/login")

  const isLoginPage = pathnameLower === "/login"
  const isRegisterPage = pathnameLower === "/register"
  const isVerifyPage = pathnameLower === "/verify-email"
  const isForgotPasswordPage = pathnameLower === "/forgot-password"
  const isNeedsPage = pathnameLower === "/needs"
  const isGiftLibraryPage = pathnameLower === "/gift-library"
  const isOrganizationsPage = pathnameLower === "/organizations"

  const isAdminLoginPage = pathnameLower === "/admin-login"

  const isAuthView =
    isLoginPage || isRegisterPage || isVerifyPage || isForgotPasswordPage

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[100] border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <HeartHandshake className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-black tracking-tighter text-xl text-foreground">
              HelpLift
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={`rounded-full px-4 gap-2 font-bold text-sm ${
                isNeedsPage ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Link href="/needs">
                <HeartHandshake className="w-4 h-4" />
                <span>Browse Needs</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={`rounded-full px-4 gap-2 font-bold text-sm ${
                isGiftLibraryPage ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Link href="/gift-library">
                <Gift className="w-4 h-4" />
                <span>Gift Library</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={`rounded-full px-4 gap-2 font-bold text-sm ${
                isOrganizationsPage ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Link href="/organizations">
                <Building2 className="w-4 h-4" />
                <span>Organizations</span>
              </Link>
            </Button>
          </div>

          {/* Right Buttons */}
          <div className="flex items-center gap-2">
            {/* Light / Dark / High-contrast / Grayscale toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label={THEME_LABEL[themeMode]}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90"
            >
              {themeMode === "light" && <Moon className="w-6 h-6 md:w-5 md:h-5" />}
              {themeMode === "dark" && <Contrast className="w-6 h-6 md:w-5 md:h-5" />}
              {themeMode === "high-contrast" && <Palette className="w-6 h-6 md:w-5 md:h-5" />}
              {themeMode === "grayscale" && <Sun className="w-6 h-6 md:w-5 md:h-5" />}
            </button>

            {/* Verification Button */}
            {(isLoginPage || isRegisterPage) && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
              >
                <Link href="/verify-email">
                  <ShieldCheck className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                  <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                    Verification
                  </span>
                </Link>
              </Button>
            )}

            {/* Back to Login Button */}
            {isForgotPasswordPage && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
              >
                <Link href="/login">
                  <ChevronLeft className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                  <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                    Back to Login
                  </span>
                </Link>
              </Button>
            )}

            {/* About Button - links to the homepage's #about section, so it
                only makes sense to show there; on other public pages like
                /needs or /gift-library there's no matching anchor and it was
                just a dead link. On the admin portal it becomes a plain "Home"
                link back to the main site instead, since there's no about
                section to jump to from there. */}
            {!isNeedsPage && !isGiftLibraryPage && !isOrganizationsPage && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${
                    isAuthView ? "hidden" : "hidden md:flex"
                  } gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group`}
                  asChild
                >
                  <a href={isAdminLoginPage ? "/" : "/#about"}>
                    {isAdminLoginPage ? <Home className="w-7 h-7 md:w-4 md:h-4 shrink-0" /> : <Info className="w-7 h-7 md:w-4 md:h-4 shrink-0" />}
                    <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                      {isAdminLoginPage ? "Home" : "About"}
                    </span>
                  </a>
                </Button>

                <div
                  className={`h-6 w-[1px] bg-border mx-2 ${
                    isAuthView ? "hidden" : "hidden md:block"
                  }`}
                />
              </>
            )}

            {dashboardPath ? (
              /* Already signed in - one link back to their dashboard instead of Log In/Register. */
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(dashboardPath)}
                data-tip="You're signed in - go to your dashboard"
                className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
              >
                <LayoutDashboard className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                <span className="font-bold max-w-0 md:max-w-[140px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                  Dashboard
                </span>
              </Button>
            ) : (
              <>
                {/* Log In Button */}
                {!isLoginPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
                    onClick={handleLoginRedirect}
                  >
                    <LogIn className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                    <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                      Log In
                    </span>
                  </Button>
                )}

                {/* Register Button */}
                {!isRegisterPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/register")}
                    className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
                  >
                    <UserPlus className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                    <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                      Register
                    </span>
                  </Button>
                )}
              </>
            )}

            {/* Home Button */}
            {(isLoginPage || isRegisterPage || isVerifyPage || isNeedsPage || isGiftLibraryPage || isOrganizationsPage) && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full px-2 md:px-4 transition-all overflow-hidden group"
              >
                <Link href="/">
                  <Home className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                  <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                    Home
                  </span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>
    </>
  )
}