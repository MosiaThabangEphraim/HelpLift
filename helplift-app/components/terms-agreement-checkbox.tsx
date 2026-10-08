"use client"

import Link from "next/link"

// Required on the registration form (/register) - the only way to create an
// account (Google/LinkedIn/Microsoft are sign-in only). Opens in a new tab so filling out a long
// registration form isn't lost just to go read it.
export function TermsAgreementCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
        required
      />
      <span>
        I agree to HelpLift's{" "}
        <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
          Privacy Policy
        </Link>
        .
      </span>
    </label>
  )
}
