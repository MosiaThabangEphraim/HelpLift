"use client"

import { ChevronDown } from "lucide-react"

// Phones only (md:hidden): one tidy dropdown in place of a row of filter chips
// that would otherwise scroll sideways. It's a native <select>, so the phone
// shows its own picker. Pair it with the desktop chips marked max-md:hidden.
export function MobileFilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className = "",
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  icon?: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <label className={`md:hidden relative flex w-full items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 px-3 py-2 ${className}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value as T)}
        aria-label={label}
        className="min-w-0 flex-1 appearance-none bg-transparent pr-6 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
    </label>
  )
}
