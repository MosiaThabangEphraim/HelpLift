"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { logClientAction } from "@/components/activity-tracker"

// First-time dashboard tour: a few dismissible step-by-step cards that spotlight
// where things are. Shown once per account - to a giver on their first visit
// after registering, to an organization team member on their first visit to
// the dashboard (only reachable once an admin has approved the organization),
// and to an administrator on their first visit after accepting their invite. Completion is saved in the user's own auth metadata, so it
// follows them across devices without a database change.
//
// Accounts created before the tour existed never see it (they already know
// their way around). Add ?tour=1 to a dashboard URL to replay it - handy for
// demos and testing.

export type TourRole = "giver" | "organization" | "admin"
type TourStep = { target?: string; title: string; body: string }

const TOUR_LAUNCH = "2026-10-05T00:00:00Z"
const DONE_KEY: Record<TourRole, string> = { giver: "dashboard_tour_giver_done_at", organization: "dashboard_tour_organization_done_at", admin: "dashboard_tour_admin_done_at" }

function stepsFor(role: TourRole, name?: string | null): TourStep[] {
  const hello = name ? `Welcome, ${name}!` : "Welcome to HelpLift!"
  if (role === "admin") {
    return [
      { title: `${hello} 🛡️`, body: "This is the HelpLift admin dashboard, where you keep the platform safe and moving. Here's a quick tour - you can skip it any time." },
      { target: '[data-tour="admin-stats"]', title: "What needs you right now", body: "These cards count everything waiting on an admin - approvals, needs to review, donations to confirm, withdrawals, stories and unread messages." },
      { target: '[data-tour="tab-users"]', title: "Users and organization approvals", body: "Verify new organizations and check their documents here. Switch to Givers, Admins (where you invite other administrators) or All users." },
      { target: '[data-tour="tab-needs"]', title: "Review needs", body: "Approve or reject needs before they go public, and decide on requests to reopen closed needs." },
      { target: '[data-tour="tab-donations"]', title: "Confirm donations", body: "Check EFT proof of payment and confirm donations - the giver's receipt is emailed automatically. The Gift Library and Fulfillments tabs work the same way for pledges and deliveries." },
      { target: '[data-tour="tab-withdrawals"]', title: "Pay out organizations", body: "Review withdrawal requests and attach proof of payment once the money is sent." },
      { target: '[data-tour="tab-stories"]', title: "Approve impact stories", body: "Organizations' stories are published on their profiles and the homepage only after you approve them." },
      { target: '[data-tour="tab-reports"]', title: "Reports", body: "All-time totals, site visits and charts for any date range - with CSV and image exports." },
      { target: '[data-tour="live-activity"]', title: "Live activity", body: "See who's online right now and what signed-in users are doing - pages opened and actions taken - updated every 10 seconds." },
      { target: '[data-tour="security"]', title: "Security", body: "Every sign-in attempt, successful or not - with IP address, location and device - plus warnings about repeated failures." },
      { target: '[data-tour="dev-reports"]', title: "Feedback and dev reports", body: "Dev reports holds the anonymous bugs and ideas sent from the Developers page. Feedback, just beside it, has ratings from givers and organizations." },
      { target: '[data-tour="settings"]', title: "Settings, announcements and more", body: "Settings covers your login and Platform settings (maintenance mode, bank accounts, need categories and limits). The megaphone sends announcements, and the bell lists what needs review." },
      { title: "You're all set", body: "Need more help? Download the user manual from Settings for a step-by-step guide to the whole app, or just ask Lifty." },
    ]
  }
  if (role === "giver") {
    return [
      { title: `${hello} 👋`, body: "Here's a quick tour of everything on your dashboard - about a minute. You can skip it any time." },
      { target: '[data-tour="tab-needs"]', title: "Find needs to support", body: "Browse Needs shows verified needs matched to your preferred causes and locations - or switch on \"near me\". Open one to offer help or donate." },
      { target: '[data-tour="tab-interests"]', title: "Your offers to help", body: "Every need you've offered to help with, and whether the organization has accepted, is tracked in My Interests." },
      { target: '[data-tour="tab-gifts"]', title: "Pledge to the Gift Library", body: "Have goods, a service or funds to give before a need exists? Pledge them here - or snap a photo and let Lifty fill in the details." },
      { target: '[data-tour="tab-fulfillments"]', title: "Follow your deliveries", body: "Once an offer is accepted, Fulfillments tracks the delivery - including the proof photos the organization uploads." },
      { target: '[data-tour="tab-donations"]', title: "Track your donations", body: "Every donation, its status, your proof of payment and your PDF receipts live in My Donations." },
      { target: '[data-tour="tab-messages"]', title: "Messages", body: "Chat with organizations and HelpLift's team. Replies show up here and in your notifications." },
      { target: '[data-tour="tab-analytics"]', title: "See your impact", body: "Analytics charts your giving over time - you can export the charts too." },
      { target: '[data-tour="notifications"]', title: "Stay in the loop", body: "The bell shows updates as they happen - accepted offers, confirmed donations, new messages and more." },
      { target: '[data-tour="badges"]', title: "Earn badges", body: "Badges celebrate your giving milestones, with your progress to the next one and the top givers leaderboard." },
      { target: '[data-tour="settings"]', title: "Settings and handy buttons", body: "Settings is where you edit your profile, turn on two-factor sign-in and choose your notifications. Nearby, ↻ refreshes your data and the house icon takes you home." },
      { target: '[data-tour="lifty"]', title: "Ask Lifty anything", body: "Lifty, your AI assistant, answers questions and finds needs for you - type, or tap the headphones and just talk." },
      { title: "You're all set", body: "Need more help? Download the user manual from Settings for a step-by-step guide to the whole app, or just ask Lifty." },
    ]
  }
  return [
    { title: `${hello} 🎉`, body: "Your organization is verified and ready to go. Here's a quick tour of everything on your dashboard - you can skip it any time." },
    { target: '[data-tour="need-writer"]', title: "Post your first need", body: "Fill in the Create a need form - or tap \"Let Lifty write it\", describe it in a sentence, and Lifty fills it in. An admin reviews each need before it goes live." },
    { target: '[data-tour="tab-interests"]', title: "Accept offers to help", body: "When givers offer to help with a need, accept or decline them here." },
    { target: '[data-tour="tab-fulfillments"]', title: "Manage deliveries", body: "Accepted offers and claimed gifts become fulfillments. Track them here and upload proof once items arrive." },
    { target: '[data-tour="tab-wallet"]', title: "Donations and your wallet", body: "Donations shows every gift of money you receive. Wallet holds your balance, banking details and withdrawal requests." },
    { target: '[data-tour="tab-messages"]', title: "Messages", body: "Chat with givers and HelpLift's team. New replies also appear in your notifications." },
    { target: '[data-tour="tab-stories"]', title: "Share your impact", body: "Post impact stories with photos or videos. Once approved they appear on your public profile and the HelpLift homepage." },
    { target: '[data-tour="tab-gifts"]', title: "Claim from the Gift Library", body: "Givers pledge goods, services and funds before a need exists. Browse them here and claim what helps you." },
    { target: '[data-tour="tab-team"]', title: "Bring in your team", body: "Invite teammates by email as Owners, Managers or Coordinators (who handle deliveries, messages and stories), so the whole team can work on HelpLift." },
    { target: '[data-tour="notifications"]', title: "Stay in the loop", body: "The bell shows new interests, donations, messages and approvals as they happen." },
    { target: '[data-tour="settings"]', title: "Settings and your profile", body: "Settings is for your organization's details, two-factor sign-in and notifications. The header also has your Public Profile, QR code, Badges and ↻ refresh - and Analytics is in the tabs." },
    { target: '[data-tour="lifty"]', title: "Ask Lifty anything", body: "Lifty, your AI assistant, can explain any part of HelpLift - type, or tap the headphones and just talk." },
    { title: "You're all set", body: "Need more help? Download the user manual from Settings for a step-by-step guide to the whole app, or just ask Lifty." },
  ]
}

// The step's element, if it's actually on screen (hidden tabs, e.g. for a
// role that can't see them, are skipped).
function findTarget(step: TourStep | undefined): HTMLElement | null {
  if (!step?.target) return null
  const element = document.querySelector<HTMLElement>(step.target)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 ? element : null
}

const CARD_WIDTH = 320
const GAP = 12

export function DashboardTour({ role, name }: { role: TourRole; name?: string | null }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Decide whether to show it.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const forced = new URLSearchParams(window.location.search).get("tour") === "1"
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const done = !!user.user_metadata?.[DONE_KEY[role]]
      const isNewAccount = new Date(user.created_at).getTime() >= new Date(TOUR_LAUNCH).getTime()
      if (forced || (isNewAccount && !done)) {
        // Let the dashboard finish laying out before the first spotlight.
        window.setTimeout(() => { if (!cancelled) setSteps(stepsFor(role, name)) }, 800)
      }
    }
    check().catch(() => {})
    return () => { cancelled = true }
    // Only on first mount - a name arriving later shouldn't restart the tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  const finish = useCallback(async () => {
    setSteps(null)
    try {
      const supabase = createClient()
      await supabase.auth.updateUser({ data: { [DONE_KEY[role]]: new Date().toISOString() } })
    } catch {
      // Not critical - worst case the tour shows once more next visit.
    }
  }, [role])

  const step = steps?.[index]

  // Track where the current step's element is (it can move as the page scrolls or resizes).
  useEffect(() => {
    if (!step) return
    const element = findTarget(step)
    if (!element) { setRect(null); return }
    element.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" })
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(element.getBoundingClientRect()))
    }
    update()
    const settle = window.setTimeout(update, 400) // after the smooth scroll
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settle)
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [step])

  // Escape skips the tour.
  useEffect(() => {
    if (!steps) return
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") finish() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [steps, finish])

  if (!steps || !step) return null

  // Steps whose element isn't on screen are skipped when moving through the tour.
  const move = (direction: 1 | -1) => {
    let next = index + direction
    while (next > 0 && next < steps.length && steps[next].target && !findTarget(steps[next])) next += direction
    if (next >= steps.length) { finish(); return }
    setIndex(Math.max(0, next))
  }

  const isLast = (() => {
    for (let i = index + 1; i < steps.length; i++) if (!steps[i].target || findTarget(steps[i])) return false
    return true
  })()
  const visibleCount = steps.filter((s, i) => i === index || !s.target || findTarget(s)).length
  const visibleNumber = steps.slice(0, index + 1).filter((s, i) => i === index || !s.target || findTarget(s)).length

  // Card placement: under the element if there's room, otherwise above it;
  // centred on screen for the welcome step (or if the element is missing).
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768
  const cardWidth = Math.min(CARD_WIDTH, viewportWidth - 32)
  let cardStyle: React.CSSProperties
  if (step.target && rect) {
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardWidth / 2), viewportWidth - cardWidth - 16)
    const below = rect.bottom + GAP + 220 < viewportHeight
    cardStyle = below ? { top: rect.bottom + GAP, left, width: cardWidth } : { bottom: viewportHeight - rect.top + GAP, left, width: cardWidth }
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: cardWidth }
  }

  return (
    <div className="fixed inset-0 z-[9996] pointer-events-none" role="dialog" aria-modal="false" aria-label="Dashboard tour">
      {step.target && rect ? (
        // Spotlight: a ring around the element, with everything else dimmed by its shadow.
        <div
          className="absolute rounded ring-2 ring-blue-500 transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(11, 18, 32, 0.6)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#0B1220]/60" />
      )}

      <div
        className="absolute pointer-events-auto rounded border border-slate-200 dark:border-[#233350] border-t-2 border-t-blue-600 dark:border-t-blue-500 bg-white dark:bg-[#121B2E] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <Sparkles className="h-3.5 w-3.5" /> Step {visibleNumber} of {visibleCount}
          </p>
          <button type="button" onClick={() => { logClientAction("Skipped the dashboard tour"); finish() }} aria-label="Skip the tour" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => { logClientAction("Skipped the dashboard tour"); finish() }} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => move(-1)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#121B2E] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!isLast) return move(1)
                logClientAction("Completed the dashboard tour")
                finish()
              }}
              autoFocus
              className="inline-flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {isLast ? "Got it" : index === 0 ? "Show me around" : "Next"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
