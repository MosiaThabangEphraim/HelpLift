"use client"

import { Check, X } from "lucide-react"
import { PASSWORD_REQUIREMENTS } from "@/lib/password"

/** Live checklist shown under a password field as the user types. */
export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
      {PASSWORD_REQUIREMENTS.map(req => {
        const met = req.test(password)
        return (
          <li key={req.key} className={`flex items-center gap-1.5 text-xs font-medium ${met ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
            {met ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>{req.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
