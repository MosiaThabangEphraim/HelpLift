"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Bot, EyeOff, Sparkles, X, User, Send } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isAssistantEnabled, onAssistantPreferenceChange, setAssistantEnabled } from "@/lib/assistant-preference"

// The floating HelpLift Assistant, rendered once for every page of the site from
// app/layout.tsx. Answers come from /api/assistant, which works out who the
// user is from their own session - the role detected here only picks the
// opening greeting. Signed-in users (givers, organizations, admins) who don't
// want it can hide it (see lib/assistant-preference.ts) and turn it back on in
// Settings; visitors who aren't signed in always see it.

type Role = "giver" | "organization" | "guest"
type ChatMessage = { role: "user" | "assistant"; text: string; isError?: boolean }

// Must match the limits enforced in app/api/assistant/route.ts.
const MAX_MESSAGE_LENGTH = 1000
const MAX_HISTORY = 20

const FRIENDLY_ERROR = "I'm having trouble connecting right now. Please try again in a moment."

// Replies mention HelpLift pages as paths ("/needs?need=<id>"). These turn them
// into short clickable buttons so users never see raw IDs. Only site-relative
// paths are matched (a "/" not preceded by a letter, digit or another "/"), so
// a reply can never link anywhere outside HelpLift. A path wrapped in brackets
// loses the brackets.
const SITE_PATH = /\((\/[a-z][a-z0-9-]*(?:\/[A-Za-z0-9-]+)*(?:\?[A-Za-z0-9=&_-]+)?)\)|(?<![\w/])(\/[a-z][a-z0-9-]*(?:\/[A-Za-z0-9-]+)*(?:\?[A-Za-z0-9=&_-]+)?)/g

function linkLabel(path: string) {
  if (path.startsWith("/needs?need=")) return "View need"
  if (path === "/needs" || path.startsWith("/needs?")) return "Browse needs"
  if (/^\/organizations\/[^?]+\?story=/.test(path)) return "Read story"
  if (path.startsWith("/organizations/")) return "View organization"
  if (path === "/organizations") return "Browse organizations"
  if (path.startsWith("/gift-library")) return "Open Gift Library"
  return path // short, readable paths like /register or /login stay as they are
}

function withSiteLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(SITE_PATH)) {
    const path = match[1] || match[2]
    nodes.push(text.slice(last, match.index))
    nodes.push(
      <Link
        key={`${match.index}-${path}`}
        href={path}
        className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors align-middle"
      >
        {linkLabel(path)}
        <ArrowRight className="h-3 w-3" />
      </Link>
    )
    last = (match.index ?? 0) + match[0].length
  }
  nodes.push(text.slice(last))
  return nodes
}

function greetingFor(role: Role) {
  if (role === "giver") return "Hi there! I'm your HelpLift Assistant. Need help browsing needs, managing your pledges, or tracking donations?"
  if (role === "organization") return "Hi there! I'm your HelpLift Assistant. Need help posting needs, uploading verification documents, or claiming gifts?"
  return "Hi there! I'm your HelpLift Assistant. How can I help you navigate our giving platform today?"
}

export function HelpLiftAssistant() {
  const pathname = usePathname()
  // Both null until known, so a hidden assistant never flashes on screen.
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: greetingFor("guest") }])
  const [isTyping, setIsTyping] = useState(false)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  // Tailor the greeting once we know who's signed in - only while the chat is
  // still untouched, so an ongoing conversation is never rewritten.
  useEffect(() => {
    let cancelled = false
    const detectRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      let role: Role = "guest"
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
        if (profile?.role === "giver" || profile?.role === "organization") role = profile.role
      }
      if (cancelled) return
      setSignedIn(!!user)
      setMessages(current => (current.length === 1 && current[0].role === "assistant" ? [{ role: "assistant", text: greetingFor(role) }] : current))
    }
    detectRole().catch(() => { if (!cancelled) setSignedIn(false) })
    return () => { cancelled = true }
  }, [pathname])

  useEffect(() => {
    const sync = () => setEnabled(isAssistantEnabled())
    sync()
    return onAssistantPreferenceChange(sync)
  }, [])

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  if (signedIn === null || enabled === null) return null
  // Hiding is only for signed-in users - visitors always get the assistant.
  if (signedIn && !enabled) return null

  const hideAssistant = () => {
    setIsChatOpen(false)
    setAssistantEnabled(false)
    toast("AI Assistant hidden", {
      description: "Turn it back on any time in Settings.",
      action: { label: "Undo", onClick: () => setAssistantEnabled(true) },
    })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedInput = chatInput.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!trimmedInput || isTyping) return

    const userMessage: ChatMessage = { role: "user", text: trimmedInput }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setChatInput("")
    setIsTyping(true)

    try {
      // Error bubbles are only for the user to see - never part of the conversation sent to the model.
      const history = updatedMessages.filter(m => !m.isError).slice(-MAX_HISTORY).map(({ role, text }) => ({ role, text }))
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.reply) throw new Error(data.message || FRIENDLY_ERROR)

      setMessages(prev => [...prev, { role: "assistant", text: data.reply }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", text: err?.message || FRIENDLY_ERROR, isError: true }])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[150]">
      {!isChatOpen ? (
        <button
          onClick={() => setIsChatOpen(true)}
          className="relative group flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-[0_10px_30px_rgb(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label="Open AI Assistant"
        >
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
          <Bot className="w-6 h-6" />
        </button>
      ) : (
        <div className="w-[calc(100vw-2rem)] sm:w-[400px] h-[min(520px,calc(100dvh-6rem))] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-inner">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">HelpLift Assistant</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Online & Ready</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {signedIn && (
                <button
                  onClick={hideAssistant}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  aria-label="Hide the assistant"
                  data-tip="Hide the assistant on every page (turn it back on in Settings)"
                >
                  <EyeOff className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div aria-live="polite" className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-slate-900 text-white" : "bg-blue-600 text-white"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line break-words ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : msg.isError
                      ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-tl-none"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm rounded-tl-none"
                  }`}
                >
                  {msg.role === "assistant" && !msg.isError ? withSiteLinks(msg.text) : msg.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Input form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask anything about HelpLift..."
              value={chatInput}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setChatInput(e.target.value)}
              aria-label="Message the HelpLift Assistant"
              className="flex-1 min-w-0 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              disabled={isTyping || !chatInput.trim()}
              aria-label="Send message"
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center shadow-md transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
