import { cn } from "@/lib/utils"

// An organization's logo (organizations.logo_url), falling back to its first
// initial - the same look as the /organizations directory. Size and text size
// come from className (default h-8 w-8). Logos are public, like the rest of an
// organization's profile.
export function OrgLogo({
  src,
  name,
  className,
}: {
  src?: string | null
  name?: string | null
  className?: string
}) {
  const base = cn("h-8 w-8 shrink-0 rounded text-xs", className)
  if (src) {
    return <img src={src} alt={name ? `${name} logo` : "Organization logo"} className={cn(base, "object-cover border border-slate-200 dark:border-[#233350] bg-white")} />
  }
  return (
    <span aria-hidden="true" className={cn(base, "inline-flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-500 font-bold text-white")}>
      {(name || "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}
