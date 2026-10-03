"use client"

import { useState, useEffect, useRef } from "react"
import { Bot, Sparkles, X, User, Send } from "lucide-react"

interface HelpLiftAssistantProps {
  role?: "giver" | "organization" | "guest"
}

export function HelpLiftAssistant({ role = "guest" }: HelpLiftAssistantProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  
  const initialGreeting =
    role === "giver"
      ? "Hi there! I'm your HelpLift Assistant. Need help browsing needs, managing your pledges, or tracking donations?"
      : role === "organization"
      ? "Hi there! I'm your HelpLift Assistant. Need help posting needs, uploading verification documents, or claiming gifts?"
      : "Hi there! I'm your HelpLift Assistant. How can I help you navigate our giving platform today?"

  const [messages, setMessages] = useState([
    { role: "assistant", text: initialGreeting },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedInput = chatInput.trim()
    if (!trimmedInput || isTyping) return

    const userMessage = { role: "user", text: trimmedInput }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setChatInput("")
    setIsTyping(true)

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Failed to fetch response.")

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err.message || "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[150]">
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
        <div className="w-[360px] md:w-[400px] h-[520px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
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
            <button
              onClick={() => setIsChatOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors"
              aria-label="Close Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
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
                  className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-tr-none"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm rounded-tl-none"
                  }`}
                >
                  {msg.text}
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
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm text-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              className="w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center shadow-md transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}