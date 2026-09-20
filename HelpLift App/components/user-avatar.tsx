"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

// A person's profile picture, falling back to their first initial. Size and
// text size come from className (e.g. "size-14 text-lg").
export function UserAvatar({
  src,
  name,
  className,
}: {
  src?: string | null
  name?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-10 shrink-0", className)}>
      {src ? <AvatarImage src={src} alt={name ? `${name}'s profile picture` : "Profile picture"} className="object-cover" /> : null}
      <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-600 font-bold text-white">
        {(name || "?").trim().charAt(0).toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  )
}
