"use client"

import { ArrowLeft } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { canGoBackFrom } from "@/lib/route-history"

// "Back" for pages people reach from somewhere else in the site. Goes back to the
// page they came from; if they opened this page directly it goes to `fallbackHref`
// instead, so it never sends anyone off the site or does nothing. Styled like the
// Refresh pill: borderless, shaded only on hover.
export function BackButton({
  fallbackHref = "/",
  label = "Back",
  className = "",
}: {
  fallbackHref?: string
  label?: string
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const goBack = () => {
    if (canGoBackFrom(pathname)) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white transition-colors ${className}`}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}
