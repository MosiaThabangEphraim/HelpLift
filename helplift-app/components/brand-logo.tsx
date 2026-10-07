// The HelpLift logo (public/logo.png - a round, transparent PNG). Set its size
// with className, e.g. <BrandLogo className="h-8 w-8" />.
export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="HelpLift" width={256} height={256} draggable={false} className={`shrink-0 select-none rounded-full object-contain ${className}`} />
  )
}
