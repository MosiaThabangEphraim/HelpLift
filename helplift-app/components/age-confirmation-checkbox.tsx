"use client"

// Givers must be 18 or older. Required on the registration form (/register) -
// the only way to create an account. The API route enforces it too, so
// skipping the checkbox client-side doesn't help.
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
