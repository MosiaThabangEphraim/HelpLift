"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CornerUpLeft, Loader2, Paperclip } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { MessageComposeDialog } from "@/components/message-compose-dialog"

export type MessageDetail = {
  id: string
  title: string
  message: string
  /** Notification type; only person-to-person messages are conversations you can reply to. */
  type?: string
  sender_id?: string | null
  sender_name?: string | null
  sender_role?: string | null
  /** Set when this message is itself a reply: a snapshot of the message it answers. */
  reply_to_snippet?: string | null
  created_at: string
  attachment_file_name?: string | null
  attachmentUrl?: string | null
  attachments?: { id: string; file_name: string | null; url: string | null }[]
}

type ThreadAttachment = { id: string; file_name: string | null; url: string | null }
type ThreadMessage = {
  id: string
  sender_id: string | null
  sender_name: string | null
  sender_role: string | null
  recipient_id: string
  message: string
  created_at: string
  mine: boolean
  attachments: ThreadAttachment[]
}

// System notifications (need approved, gift claim declined...) have a sender
// but aren't a conversation; only direct messages get a thread and a Reply button.
const CONVERSATION_TYPES = new Set(["message_to_admin", "admin_message", "org_message"])

function AttachmentLinks({ attachments, className = "" }: { attachments: ThreadAttachment[]; className?: string }) {
  if (attachments.length === 0) return null
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {attachments.map(attachment => (
        <a
          key={attachment.id}
          href={attachment.url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold underline"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {attachment.file_name || "Download attachment"}
        </a>
      ))}
    </div>
  )
}

export function MessageDetailDialog({
  open,
  onOpenChange,
  message,
  canReply = true,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: MessageDetail | null
  /** Pass false where the signed-in user isn't allowed to send messages (e.g. an organization viewer). */
  canReply?: boolean
}) {
  const [isReplying, setIsReplying] = useState(false)
  const [thread, setThread] = useState<{ me: string; messages: ThreadMessage[] } | null>(null)
  const [isLoadingThread, setIsLoadingThread] = useState(false)
  const [threadError, setThreadError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)

  const isConversation = !!message?.type && CONVERSATION_TYPES.has(message.type)

  const loadThread = useCallback(async (messageId: string) => {
    setIsLoadingThread(true)
    setThreadError("")
    try {
      const res = await fetch(`/api/messages/thread?messageId=${encodeURIComponent(messageId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || "Could not load the conversation.")
      setThread({ me: data.me, messages: data.messages || [] })
    } catch (err: any) {
      setThreadError(err.message || "Could not load the conversation.")
    } finally {
      setIsLoadingThread(false)
    }
  }, [])

  useEffect(() => {
    setThread(null)
    setThreadError("")
    if (open && message && isConversation) loadThread(message.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, message?.id])

  // Keep the newest message in view.
  useEffect(() => {
    if (thread) endRef.current?.scrollIntoView({ block: "end" })
  }, [thread])

  // You reply to the latest message addressed to you in the conversation (which
  // may be newer than the one you opened); fall back to the one you opened.
  const latestReceived = thread ? [...thread.messages].reverse().find(m => m.recipient_id === thread.me && !m.mine && m.sender_id) : undefined
  const replyTarget = latestReceived
    ? { id: latestReceived.id, snippet: latestReceived.message, name: latestReceived.sender_name || "sender" }
    : message?.sender_id && isConversation
      ? { id: message.id, snippet: message.message, name: message.sender_name || "sender" }
      : null
  const showReply = canReply && isConversation && !!replyTarget

  const showThread = isConversation && thread && thread.messages.length > 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{message?.title}</DialogTitle>
          </DialogHeader>
          {message && (
            <div className="space-y-4 pt-1">
              {showThread ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Conversation · {thread!.messages.length} message{thread!.messages.length === 1 ? "" : "s"}
                  </p>
                  <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                    {thread!.messages.map(item => (
                      <div key={item.id} className={`flex ${item.mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                            item.mine
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-slate-100 dark:bg-[#1A2740] text-slate-800 dark:text-slate-100 rounded-bl-md"
                          } ${item.id === message.id ? "ring-2 ring-blue-300 dark:ring-blue-500/60" : ""}`}
                        >
                          <p className={`mb-0.5 text-[11px] font-bold ${item.mine ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
                            {item.mine && item.sender_id === thread!.me ? "You" : item.sender_name || "Unknown sender"}
                            {item.mine && item.sender_id !== thread!.me ? " (your team)" : ""}
                            {item.sender_role && !item.mine ? <span className="capitalize font-medium"> · {item.sender_role}</span> : null}
                          </p>
                          <p className="whitespace-pre-line">{item.message}</p>
                          <AttachmentLinks attachments={item.attachments} className={`mt-1.5 ${item.mine ? "text-white" : "text-blue-600 dark:text-blue-400"}`} />
                          <p className={`mt-1 text-[10px] ${item.mine ? "text-blue-100" : "text-slate-400"}`}>{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                </>
              ) : (
                <>
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

                  {message.reply_to_snippet && (
                    <blockquote className="rounded-xl border-l-4 border-blue-500 bg-slate-50 dark:bg-[#0B1220] px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                      <p className="mb-0.5 flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400">
                        <CornerUpLeft className="w-3 h-3" /> In reply to your message
                      </p>
                      <p className="line-clamp-4 whitespace-pre-line">{message.reply_to_snippet}</p>
                    </blockquote>
                  )}

                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">{message.message}</p>
                  {message.attachments && message.attachments.length > 0 ? (
                    <AttachmentLinks attachments={message.attachments} className="text-blue-600" />
                  ) : message.attachmentUrl ? (
                    <AttachmentLinks
                      attachments={[{ id: "single", file_name: message.attachment_file_name || null, url: message.attachmentUrl }]}
                      className="text-blue-600"
                    />
                  ) : null}

                  {isConversation && isLoadingThread && (
                    <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading the conversation…</p>
                  )}
                  {isConversation && threadError && <p className="text-xs text-slate-400">{threadError}</p>}
                </>
              )}

              {showReply && (
                <Button type="button" variant="outline" className="w-full" onClick={() => setIsReplying(true)}>
                  <CornerUpLeft className="w-4 h-4 mr-1.5" /> Reply
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showReply && replyTarget && (
        <MessageComposeDialog
          open={isReplying}
          onOpenChange={setIsReplying}
          recipientLabel={replyTarget.name}
          replyTo={{ id: replyTarget.id, snippet: replyTarget.snippet }}
          onSent={() => message && loadThread(message.id)}
        />
      )}
    </>
  )
}
