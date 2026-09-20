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
  Sparkles,
  ChevronLeft,
  ShieldCheck,
  HeartHandshake,
  Gift,
  Building2,
} from "lucide-react"
import Link from "next/link"

export default function PublicNavbar() {
  const router = useRouter()
  const pathname = usePathname()

  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const pathnameLower = pathname.toLowerCase()

  const isDarkMode =
    mounted ? (resolvedTheme || theme) === "dark" : true // during hydration

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
    setTheme(isDarkMode ? "light" : "dark")
  }

  const handleLoginRedirect = () => router.push("/login")

  const isLoginPage = pathnameLower === "/login"
  const isRegisterPage = pathnameLower === "/register"
  const isVerifyPage = pathnameLower === "/verify-email"
  const isForgotPasswordPage = pathnameLower === "/forgot-password"
  const isNeedsPage = pathnameLower === "/needs"
  const isGiftLibraryPage = pathnameLower === "/gift-library"
  const isOrganizationsPage = pathnameLower === "/organizations"

  const isAuthView =
    isLoginPage || isRegisterPage || isVerifyPage || isForgotPasswordPage

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-[100] border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center transition-transform group-hover:scale-105">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
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
            {/* Dark/Light Mode toggle */}
            <button
              onClick={toggleDarkMode}
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-90"
            >
              {isDarkMode ? (
                <svg
                  className="w-6 h-6 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 md:w-5 md:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
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

            {/* About Button — links to the homepage's #about section, so it
                only makes sense to show there; on other public pages like
                /needs or /gift-library there's no matching anchor and it was
                just a dead link. */}
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
                  <a href="/#about">
                    <Info className="w-7 h-7 md:w-4 md:h-4 shrink-0" />
                    <span className="font-bold max-w-0 md:max-w-[100px] inline-block transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden">
                      About
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