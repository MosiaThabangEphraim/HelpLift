"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Award, AtSign, Banknote, Bell, BookOpen, Bot, Clock, CornerDownLeft, Landmark, Tags, Trophy, Wallet, Wrench, Fingerprint, KeyRound, Mail, Mic, MousePointerClick, Palette, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, Type, UserRound, X } from "lucide-react"
import { MicButton } from "@/components/mic-button"

// "Search anything" box at the top left of each dashboard (desktop only).
// Finds the dashboard's sections and its actions and settings, e.g. "wallet",
// "change password", "font size", "hey lifty". Type or speak (microphone);
// Ctrl+K (Cmd+K) or "/" jumps to it, arrow keys move, Enter opens, Esc closes.

export type DashboardSearchItem = {
  id: string
  label: string
  group: "Sections" | "Actions" | "Settings"
  icon: React.ComponentType<{ className?: string }>
  /** Extra words people might search with (synonyms). */
  keywords?: string
  hint?: string
  onSelect: () => void
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()

// Every word typed must appear somewhere (label, keywords or group); words at
// the start of the label rank first.
function score(item: DashboardSearchItem, query: string) {
  const words = normalize(query).split(" ").filter(Boolean)
  if (words.length === 0) return 0
  const label = normalize(item.label)
  const haystack = `${label} ${normalize(item.keywords || "")} ${normalize(item.hint || "")} ${item.group.toLowerCase()}`
  let total = 0
  for (const word of words) {
    if (!haystack.includes(word)) return -1
    total += label.startsWith(word) ? 3 : label.includes(word) ? 2 : 1
  }
  return total
}

const GROUP_ORDER: DashboardSearchItem["group"][] = ["Sections", "Actions", "Settings"]

/**
 * Opens a window (via `open`) and scrolls to one thing inside it, briefly
 * highlighted. `target` is a setting title (matched to data-setting="..."),
 * a CSS selector ("#id" or "[attr]"), or the exact visible text of a label or
 * heading. Waits up to ~3 seconds for the window's content to load. If the
 * target is a field, its input gets the cursor.
 */
export function jumpTo(open: () => void, target: string) {
  open()
  const find = (): HTMLElement | null => {
    if (target.startsWith("#") || target.startsWith("[")) {
      const element = document.querySelector<HTMLElement>(target)
      return (element?.closest(".space-y-1, [data-setting]") as HTMLElement | null) || element
    }
    const tagged = document.querySelector<HTMLElement>(`[data-setting="${target.replace(/"/g, "")}"]`)
    if (tagged) return tagged
    const label = Array.from(document.querySelectorAll<HTMLElement>("[role=dialog] label, [role=dialog] h3"))
      .find(element => element.textContent?.trim() === target)
    if (!label) return null
    return label.tagName === "H3" ? (label.closest("section") as HTMLElement | null) || label : (label.closest(".space-y-1") as HTMLElement | null) || label
  }
  let tries = 0
  const attempt = () => {
    const element = find()
    if (!element) {
      if (++tries < 15) window.setTimeout(attempt, 200)
      return
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" })
    element.animate(
      [{ boxShadow: "0 0 0 0 rgba(37,99,235,0)" }, { boxShadow: "0 0 0 4px rgba(37,99,235,0.45)" }, { boxShadow: "0 0 0 0 rgba(37,99,235,0)" }],
      { duration: 1600, easing: "ease-in-out" },
    )
    const input = element.querySelector<HTMLElement>("input:not([type=checkbox]):not([type=hidden]), textarea, select")
    if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 450)
  }
  window.setTimeout(attempt, 300)
}

/** Opens Settings and scrolls to one setting row. */
export function jumpToSetting(openSettings: () => void, title: string) {
  jumpTo(openSettings, title)
}

export function DashboardSearch({ items, placeholder = "Search this dashboard..." }: { items: DashboardSearchItem[]; placeholder?: string }) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Empty box: the sections, as a starting point. Otherwise the best matches.
  const results = useMemo(() => {
    if (!query.trim()) return items.filter(item => item.group === "Sections")
    return items
      .map(item => ({ item, value: score(item, query) }))
      .filter(entry => entry.value >= 0)
      .sort((a, b) => b.value - a.value || GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group))
      .slice(0, 12)
      .map(entry => entry.item)
  }, [items, query])

  useEffect(() => { setActive(0) }, [query])

  // Ctrl+K / Cmd+K or "/" (outside a text field) focuses the search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if ((event.key === "k" && (event.ctrlKey || event.metaKey)) || (event.key === "/" && !typing)) {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Clicking elsewhere closes the results.
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!boxRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const choose = (item: DashboardSearchItem) => {
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
    item.onSelect()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, results.length - 1)) }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]) }
    else if (event.key === "Escape") { setOpen(false); inputRef.current?.blur() }
  }

  let lastGroup = ""

  return (
    <div ref={boxRef} className="relative w-full max-w-md max-md:hidden mr-auto">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search this dashboard"
          aria-expanded={open}
          aria-controls="dashboard-search-results"
          role="combobox"
          autoComplete="off"
          className="w-full rounded-full bg-white dark:bg-[#121B2E] py-2.5 pl-10 pr-24 text-sm shadow-sm outline-none ring-blue-500/30 transition-shadow placeholder:text-slate-400 focus:ring-4"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus() }} aria-label="Clear search" className="absolute right-12 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-12 top-1/2 -translate-y-1/2 rounded bg-slate-100 dark:bg-[#1A2740] px-1.5 py-0.5 text-[10px] font-bold text-slate-400">Ctrl K</kbd>
        )}
        <MicButton className="top-1/2 right-2.5 -translate-y-1/2" onText={text => { setQuery(text.trim()); setOpen(true); inputRef.current?.focus() }} />
      </div>

      {open && (
        <div id="dashboard-search-results" role="listbox" className="absolute left-0 right-0 top-full z-[160] mt-2 max-h-[60vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#121B2E] p-1.5 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nothing matches &ldquo;{query}&rdquo;. Try another word, or ask Lifty.</p>
          ) : results.map((item, index) => {
            const Icon = item.icon
            const showGroup = item.group !== lastGroup
            lastGroup = item.group
            return (
              <div key={item.id}>
                {showGroup && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${index === active ? "bg-blue-50 dark:bg-blue-950/50" : ""}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${index === active ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                    {item.hint && <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>}
                  </span>
                  {index === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Settings rows (components/settings-dialog.tsx) as search results; each opens Settings at that row. */
export function settingsSearchItems(openSettings: () => void, options: { editProfile?: boolean; loginEmail?: boolean; platform?: boolean; emailNotifications?: boolean; giverSpotlight?: boolean; deleteAccount?: boolean } = {}): DashboardSearchItem[] {
  const rows: { title: string; icon: DashboardSearchItem["icon"]; keywords: string; show?: boolean }[] = [
    { title: "Edit profile", icon: UserRound, keywords: "name phone details account information organization logo picture", show: options.editProfile },
    { title: "Login email", icon: AtSign, keywords: "email address change sign in", show: options.loginEmail },
    { title: "Change password", icon: KeyRound, keywords: "password pwd reset security" },
    { title: "Platform settings", icon: SlidersHorizontal, keywords: "maintenance bank accounts categories limits badges withdrawal donation", show: options.platform },
    { title: "Passkeys", icon: Fingerprint, keywords: "passkey fingerprint face pin biometric sign in" },
    { title: "Two-factor sign-in", icon: ShieldCheck, keywords: "2fa two factor code otp security verification" },
    { title: "Notification sounds", icon: Bell, keywords: "sound audio alert ding mute" },
    { title: "Email notifications", icon: Mail, keywords: "emails inbox notify", show: options.emailNotifications },
    { title: "Lifty (AI assistant)", icon: Bot, keywords: "lifty assistant chatbot ai hide show" },
    { title: "Hey Lifty", icon: Mic, keywords: "wake word voice microphone hands free speak" },
    { title: "Clock & date", icon: Clock, keywords: "time clock date" },
    { title: "Click sounds", icon: MousePointerClick, keywords: "click tap sound feedback" },
    { title: "Reduce motion", icon: Sparkles, keywords: "animations motion accessibility" },
    { title: "Font size", icon: Type, keywords: "text size bigger larger smaller zoom accessibility" },
    { title: "User manual", icon: BookOpen, keywords: "help guide manual pdf download instructions" },
    { title: "Giver of the Month", icon: Star, keywords: "spotlight privacy featured homepage", show: options.giverSpotlight },
    { title: "Delete account", icon: Trash2, keywords: "delete remove close account", show: options.deleteAccount },
  ]
  return rows
    .filter(row => row.show !== false)
    .map(row => ({
      id: `setting-${row.title}`,
      label: row.title,
      group: "Settings" as const,
      icon: row.icon,
      keywords: `${row.keywords} settings`,
      onSelect: () => jumpToSetting(openSettings, row.title),
    }))
}

/** Switches the theme by pressing the page's theme button. */
export const themeSearchItem: DashboardSearchItem = {
  id: "action-theme",
  label: "Switch theme",
  group: "Actions",
  icon: Palette,
  keywords: "theme dark mode light mode night high contrast grayscale appearance colours colors",
  hint: "Light, dark, high contrast or grayscale",
  onSelect: () => document.querySelector<HTMLButtonElement>("[data-theme-toggle]")?.click(),
}

/**
 * Everything inside the admin's Platform settings window
 * (components/platform-settings-admin.tsx), each as its own result.
 */
export function platformSettingsSearchItems(openPlatform: () => void): DashboardSearchItem[] {
  const entry = (id: string, label: string, target: string, icon: DashboardSearchItem["icon"], keywords: string, hint = "Platform settings"): DashboardSearchItem => ({
    id: `platform-${id}`, label, group: "Settings", icon, hint, keywords: `${keywords} platform settings`, onSelect: () => jumpTo(openPlatform, target),
  })
  const badge = (id: string, label: string, keywords: string) =>
    entry(`badge-${id}`, `Badge: ${label}`, label, Award, `badge threshold ${keywords}`, "Platform settings - badge thresholds")
  return [
    entry("maintenance", "Maintenance mode", "Maintenance mode", Wrench, "maintenance offline downtime site down closed"),
    entry("maintenance-message", "Maintenance message", "#maintenance-message", Wrench, "maintenance message text visitors"),
    entry("withdrawals", "Withdrawal amounts", "Withdrawal amounts", Wallet, "withdrawal limits payout"),
    entry("withdrawal-min", "Minimum withdrawal", "#withdrawal-min", Wallet, "withdrawal minimum limit amount payout"),
    entry("withdrawal-max", "Maximum withdrawal", "#withdrawal-max", Wallet, "withdrawal maximum limit amount payout"),
    entry("donations", "Support The Platform donation amounts", "Support The Platform donation amounts", Banknote, "donation limits platform support"),
    entry("donation-min", "Minimum platform donation", "#donation-min", Banknote, "donation minimum limit amount support the platform"),
    entry("donation-max", "Maximum platform donation", "#donation-max", Banknote, "donation maximum limit amount support the platform"),
    entry("badges", "Badge thresholds", "Badge thresholds", Award, "badges thresholds milestones"),
    entry("spotlight", "Giver / Organization of the Month", "Giver / Organization of the Month", Trophy, "spotlight featured monthly winner homepage"),
    entry("bank", "HelpLift's bank accounts", "HelpLift's bank accounts", Landmark, "bank accounts eft banking details account number branch"),
    entry("categories", "Need categories", "Need categories", Tags, "categories need category add rename retire"),
    badge("milestone-bronze", "Milestone - Bronze (R)", "giver milestone bronze rand donated"),
    badge("milestone-silver", "Milestone - Silver (R)", "giver milestone silver rand donated"),
    badge("milestone-gold", "Milestone - Gold (R)", "giver milestone gold rand donated"),
    badge("consistent", "Consistent Giver - consecutive months", "giver streak months consistent"),
    badge("needs-champion", "Needs Champion - needs fulfilled", "giver needs champion"),
    badge("category-champion", "Category Champion - donations to one category", "giver category champion"),
    badge("well-rounded", "Well-Rounded Giver - distinct categories", "giver well rounded categories"),
    badge("gift-contributor", "Gift Library Contributor - offerings claimed", "giver gift library contributor"),
    badge("platform-supporter", "Platform Supporter - donations", "giver platform supporter"),
    badge("community-connector", "Community Connector - organizations supported", "giver community connector reach"),
    badge("needs-bronze", "Needs fulfilled - Bronze", "organization needs fulfilled bronze"),
    badge("needs-silver", "Needs fulfilled - Silver", "organization needs fulfilled silver"),
    badge("needs-gold", "Needs fulfilled - Gold", "organization needs fulfilled gold"),
    badge("funds-bronze", "Funds raised - Bronze (R)", "organization funds raised bronze rand"),
    badge("funds-silver", "Funds raised - Silver (R)", "organization funds raised silver rand"),
    badge("funds-gold", "Funds raised - Gold (R)", "organization funds raised gold rand"),
    badge("storyteller", "Storyteller - approved stories", "organization storyteller stories"),
    badge("reliable-rate", "Reliable Partner - completion rate (%)", "organization reliable partner completion rate percent"),
    badge("reliable-min", "Reliable Partner - min. fulfillments", "organization reliable partner minimum fulfillments"),
    badge("fast-hours", "Fast Responder - max. average hours", "organization fast responder response hours"),
    badge("fast-min", "Fast Responder - min. responses", "organization fast responder minimum responses"),
  ]
}
