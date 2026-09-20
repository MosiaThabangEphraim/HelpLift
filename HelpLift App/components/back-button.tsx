"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { hasInAppHistory } from "@/lib/route-history"

// "Back" for pages people reach from somewhere else in the site. Goes back to the
// page they came from; if they opened this page directly it goes to `fallbackHref`
// instead, so it never sends anyone off the site or does nothing.
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

  const goBack = () => {
    if (hasInAppHistory()) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740] hover:text-blue-600 transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}
