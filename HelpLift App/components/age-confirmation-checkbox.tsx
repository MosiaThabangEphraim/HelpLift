"use client"

// Givers must be 18 or older. Required wherever a giver account is created -
// the manual form and OAuth buttons on /register, and /register/complete (where
// an OAuth sign-up actually finishes, including one started from /login). The
// API routes enforce it too, so skipping the checkbox client-side doesn't help.
export function AgeConfirmationCheckbox({
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
      <span>I confirm that I am 18 years of age or older. Givers must be at least 18 to register.</span>
    </label>
  )
}
