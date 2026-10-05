"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Bot, EyeOff, Headphones, Mic, PhoneOff, Sparkles, Square, Volume2, VolumeX, X, User, Send } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isAssistantEnabled, onAssistantPreferenceChange, setAssistantEnabled } from "@/lib/assistant-preference"
import { isSpeechToTextSupported, useSpeechToText } from "@/lib/speech-to-text"
import { isTextToSpeechSupported, primeSpeechSynthesis, speakInSentences } from "@/lib/text-to-speech"

// Lifty, the floating HelpLift AI assistant, rendered once for every page of the site from
// app/layout.tsx. Answers come from /api/assistant, which works out who the
// user is from their own session - the role detected here only picks the
// opening greeting. Signed-in users (givers, organizations, admins) who don't
// want it can hide it (see lib/assistant-preference.ts) and turn it back on in
// Settings; visitors who aren't signed in always see it.
//
// Voice: the mic button sends one spoken message; the speaker toggle reads
// Lifty's replies aloud; the headphones start a hands-free voice chat (listen,
// reply aloud, listen again) until ended. All of it uses the browser's own
// speech engines (lib/speech-to-text.ts, lib/text-to-speech.ts) - audio never
// reaches HelpLift - and each control only appears where the browser supports it.

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

// How a page path is read aloud: general pages by name; links to one specific
// need/organization/story are left to their on-screen buttons.
function spokenPath(path: string) {
  if (path === "/needs") return "the needs board"
  if (path.startsWith("/gift-library")) return "the Gift Library"
  if (path === "/organizations") return "the organizations directory"
  if (path === "/register") return "the registration page"
  if (path === "/login") return "the sign in page"
  if (/^\/[a-z-]+$/.test(path)) return `the ${path.slice(1).replace(/-/g, " ")} page`
  return ""
}

// What Lifty says aloud: no raw link paths, emojis or formatting symbols -
// plus a short mention when item links were added to the chat.
function toSpeakable(text: string) {
  let links = 0
  const spoken = text
    .replace(SITE_PATH, (_, bracketed, bare) => {
      const name = spokenPath(bracketed || bare)
      if (!name) links++
      return name
    })
    .replace(/^\s*\d+\.\s+/gm, "") // "1. " list numbers would split sentences oddly
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[*#_`>]/g, "")
    .replace(/\s+([.,!?])/g, "$1")
    .trim()
  return links > 0 ? `${spoken} I've added ${links === 1 ? "a link" : "links"} in the chat.` : spoken
}

const VOICE_REPLIES_KEY = "helplift:lifty-voice-replies"

function greetingFor(role: Role) {
  if (role === "giver") return "Hi there! I'm Lifty, your HelpLift assistant 😊 Need help browsing needs, managing your pledges, or tracking donations?"
  if (role === "organization") return "Hi there! I'm Lifty, your HelpLift assistant 😊 Need help posting needs, uploading verification documents, or claiming gifts?"
  return "Hi there! I'm Lifty, your HelpLift assistant 😊 How can I help you navigate our giving platform today?"
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

  // --- Voice ---
  const [canListen, setCanListen] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(false) // read replies aloud (remembered on this device)
  const [conversation, setConversation] = useState(false) // hands-free voice chat
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  // Refs mirror state for callbacks that outlive a render (speech events, fetches).
  const conversationRef = useRef(false)
  const voiceRepliesRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const isTypingRef = useRef(false)
  const stopSpeakingRef = useRef<(() => void) | null>(null)
  const sendMessageRef = useRef<(text: string) => void>(() => {})

  const speech = useSpeechToText(text => sendMessageRef.current(text), {
    continuous: false, // one spoken message, sent when the person pauses
    onEnd: heardSpeech => {
      if (!heardSpeech && conversationRef.current) {
        endConversation("I didn't hear anything, so I ended the voice chat. Tap the headphones to talk again.")
      }
    },
  })

  const stopSpeaking = () => {
    stopSpeakingRef.current?.()
    stopSpeakingRef.current = null
    setIsSpeaking(false)
  }

  // Says a reply aloud; in a voice chat, starts listening again once it's done.
  const speakReply = (text: string) => {
    if (!isTextToSpeechSupported()) return
    stopSpeaking()
    setIsSpeaking(true)
    stopSpeakingRef.current = speakInSentences(toSpeakable(text), () => {
      stopSpeakingRef.current = null
      setIsSpeaking(false)
      if (conversationRef.current) speech.start()
    })
  }

  const startConversation = () => {
    primeSpeechSynthesis() // lets phones speak the replies that arrive later
    stopSpeaking()
    setVoiceNote(null)
    conversationRef.current = true
    setConversation(true)
    speech.start()
  }

  function endConversation(note?: string) {
    conversationRef.current = false
    setConversation(false)
    speech.stop()
    stopSpeaking()
    if (note) setVoiceNote(note)
  }

  const toggleVoiceReplies = () => {
    const next = !voiceRepliesRef.current
    voiceRepliesRef.current = next
    setVoiceReplies(next)
    try { window.localStorage.setItem(VOICE_REPLIES_KEY, next ? "on" : "off") } catch {}
    if (next) primeSpeechSynthesis()
    else stopSpeaking()
  }

  useEffect(() => {
    setCanListen(isSpeechToTextSupported())
    setCanSpeak(isTextToSpeechSupported())
    try {
      const saved = window.localStorage.getItem(VOICE_REPLIES_KEY) === "on"
      voiceRepliesRef.current = saved
      setVoiceReplies(saved)
    } catch {}
    return () => { stopSpeakingRef.current?.() }
  }, [])

  // A microphone problem (blocked permission etc.) ends any voice chat.
  useEffect(() => {
    if (!speech.error) return
    setVoiceNote(speech.error)
    if (conversationRef.current) {
      conversationRef.current = false
      setConversation(false)
    }
  }, [speech.error])

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
    endConversation()
    setIsChatOpen(false)
    setAssistantEnabled(false)
    toast("Lifty is hidden", {
      description: "Turn it back on any time in Settings.",
      action: { label: "Undo", onClick: () => setAssistantEnabled(true) },
    })
  }

  const closeChat = () => {
    endConversation()
    setIsChatOpen(false)
  }

  // Typed and spoken messages both go through here.
  const sendMessage = async (text: string) => {
    const trimmedInput = text.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!trimmedInput || isTypingRef.current) return

    stopSpeaking()
    setVoiceNote(null)
    const userMessage: ChatMessage = { role: "user", text: trimmedInput }
    const updatedMessages = [...messagesRef.current, userMessage]
    setMessages(updatedMessages)
    setChatInput("")
    isTypingRef.current = true
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
      if (conversationRef.current || voiceRepliesRef.current) speakReply(data.reply)
    } catch (err: any) {
      const errorText = err?.message || FRIENDLY_ERROR
      setMessages(prev => [...prev, { role: "assistant", text: errorText, isError: true }])
      if (conversationRef.current) endConversation(errorText)
    } finally {
      isTypingRef.current = false
      setIsTyping(false)
    }
  }
  sendMessageRef.current = sendMessage

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(chatInput)
  }

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop()
      return
    }
    stopSpeaking()
    setVoiceNote(null)
    speech.start()
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[150]">
      {!isChatOpen ? (
        <button
          data-tour="lifty"
          onClick={() => setIsChatOpen(true)}
          className="relative group flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-[0_10px_30px_rgb(37,99,235,0.4)] hover:scale-105 active:scale-95 transition-all duration-300"
          aria-label="Chat with Lifty, the HelpLift assistant"
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
                <h4 className="font-bold text-sm leading-tight">Lifty</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Online & Ready</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canListen && canSpeak && !conversation && (
                <button
                  onClick={startConversation}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  aria-label="Start a voice chat with Lifty"
                  data-tip="Talk to Lifty hands-free - it listens, answers out loud, then listens again"
                >
                  <Headphones className="w-5 h-5" />
                </button>
              )}
              {canSpeak && (
                <button
                  onClick={toggleVoiceReplies}
                  className={`p-1 rounded transition-colors ${voiceReplies ? "text-blue-400 hover:text-blue-300" : "text-slate-400 hover:text-white"}`}
                  aria-label={voiceReplies ? "Stop reading replies aloud" : "Read Lifty's replies aloud"}
                  aria-pressed={voiceReplies}
                  data-tip={voiceReplies ? "Voice replies on - Lifty reads its answers aloud" : "Turn on voice replies"}
                >
                  {voiceReplies ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                </button>
              )}
              {signedIn && (
                <button
                  onClick={hideAssistant}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  aria-label="Hide Lifty"
                  data-tip="Hide Lifty on every page (turn it back on in Settings)"
                >
                  <EyeOff className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={closeChat}
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

          {/* Hands-free voice chat status */}
          {conversation && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40">
              <div className="flex items-center gap-2 min-w-0 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {speech.listening ? (
                  <>
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    Listening... speak now
                  </>
                ) : isTyping ? (
                  "Lifty is thinking..."
                ) : isSpeaking ? (
                  <button
                    type="button"
                    onClick={() => { stopSpeaking(); speech.start() }}
                    className="inline-flex items-center gap-1.5 hover:underline"
                    data-tip="Stop Lifty and speak"
                  >
                    <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Lifty is speaking - tap to interrupt
                  </button>
                ) : (
                  "Voice chat on"
                )}
              </div>
              <button
                type="button"
                onClick={() => endConversation()}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition-colors"
              >
                <PhoneOff className="h-3 w-3" /> End
              </button>
            </div>
          )}

          {voiceNote && !conversation && (
            <p role="status" className="px-4 pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{voiceNote}</p>
          )}

          {/* Input form */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={speech.listening ? "Listening..." : "Ask Lifty anything about HelpLift..."}
              value={chatInput}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setChatInput(e.target.value)}
              aria-label="Message Lifty"
              className="flex-1 min-w-0 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-800 dark:text-slate-200"
            />
            {canListen && !conversation && (
              <button
                type="button"
                onClick={toggleMic}
                disabled={isTyping}
                aria-label={speech.listening ? "Stop listening" : "Speak your message"}
                data-tip={speech.listening ? "Stop listening" : "Speak instead of typing - it sends when you pause"}
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-50 ${
                  speech.listening ? "bg-red-600 text-white animate-pulse" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {speech.listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
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
