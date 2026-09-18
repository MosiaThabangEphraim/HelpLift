"use client"

import { Paperclip } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type MessageDetail = {
  id: string
  title: string
  message: string
  sender_name?: string | null
  sender_role?: string | null
  created_at: string
  attachment_file_name?: string | null
  attachmentUrl?: string | null
  attachments?: { id: string; file_name: string | null; url: string | null }[]
}

export function MessageDetailDialog({
  open,
  onOpenChange,
  message,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: MessageDetail | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{message?.title}</DialogTitle>
        </DialogHeader>
        {message && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{(message.sender_name || "?").charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{message.sender_name || "Unknown sender"}</p>
                {message.sender_role && <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{message.sender_role}</p>}
              </div>
              <span className="ml-auto shrink-0 text-xs text-slate-400">{new Date(message.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{message.message}</p>
            {message.attachments && message.attachments.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {message.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {attachment.file_name || "Download attachment"}
                  </a>
                ))}
              </div>
            ) : message.attachmentUrl && (
              <a
                href={message.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
              >
                <Paperclip className="w-3.5 h-3.5" />
                {message.attachment_file_name || "Download attachment"}
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
