// Plain-text delivery status for a message you sent: "Sent" once it exists,
// "Delivered" once it's reached the other person's device, "Read" once
// they've actually opened it. Used both inside an opened conversation (see
// message-detail-dialog.tsx, shown only on your own "mine" bubbles) and in
// the Sent list (sent-messages.tsx) - you don't get to see whether you,
// personally, have read something, only whether the other side has.
export function MessageStatus({
  deliveredAt,
  readAt,
  className = "",
}: {
  deliveredAt?: string | null
  readAt?: string | null
  className?: string
}) {
  const label = readAt ? "Read" : deliveredAt ? "Delivered" : "Sent"
  return (
    <span className={`font-bold ${readAt ? "text-emerald-500 dark:text-emerald-400" : ""} ${className}`}>
      {label}
    </span>
  )
}
