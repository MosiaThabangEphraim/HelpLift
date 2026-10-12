"use client"

import { useEffect, useState } from "react"
import { Accessibility, AtSign, Check, Palette, Bell, BookOpen, Bot, Clock, Mic, Download, KeyRound, Mail, MousePointerClick, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, Type, UserRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { PasskeySettings } from "@/components/passkey-settings"
import { setReturnTo } from "@/lib/window-return"
import {
  getNotificationSoundChoice,
  isNotificationSoundEnabled,
  NOTIFICATION_SOUNDS,
  playNotificationSound,
  setNotificationSoundChoice,
  setNotificationSoundEnabled,
  unlockNotificationSound,
  type NotificationSoundId,
} from "@/lib/notification-sound"
import { getFontSizeLevel, setFontSizeLevel, type FontSizeLevel } from "@/lib/font-size"
import { isAssistantEnabled, setAssistantEnabled } from "@/lib/assistant-preference"
import { COLOR_SCHEMES, getColorScheme, setColorScheme, type ColorScheme } from "@/lib/color-scheme"
import { isWakeWordEnabled, isWakeWordSupported, setWakeWordEnabled } from "@/lib/wake-word"
import { getReduceMotion, setReduceMotion } from "@/lib/reduce-motion"
import { isClickSoundEnabled, playClickSound, setClickSoundEnabled } from "@/lib/click-sounds"
import { isClockShown, setClockShown } from "@/lib/clock-preference"
import { logClientAction } from "@/components/activity-tracker"

const FONT_SIZE_OPTIONS: { value: FontSizeLevel; label: string; size: string }[] = [
  { value: "normal", label: "Normal text", size: "13px" },
  { value: "large", label: "Large text", size: "16px" },
  { value: "larger", label: "Larger text", size: "19px" },
]

function SettingRow({
  icon,
  title,
  description,
  children,
  danger = false,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  danger?: boolean
}) {
  return (
    <div data-setting={title.replace(/"/g, "")} className={`flex h-full items-center gap-4 rounded border p-4 transition-shadow ${danger ? "border-red-200 dark:border-red-900/60" : "border-slate-200 dark:border-[#233350]"}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${danger ? "bg-red-50 dark:bg-red-950/40 text-red-600" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300"}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// One place for a person's account settings, on the giver and organization
// dashboards. Each action opens the dashboard's existing screen for it (edit
// profile, change password, delete account), so nothing is duplicated; the
// notification-sound switch lives here.
const OPEN_ACCESSIBILITY_EVENT = "helplift:open-accessibility"

const OPEN_INTERFACE_EVENT = "helplift:open-interface"

/** Opens the User interface window from anywhere on a dashboard (e.g. the search). */
export function openInterfaceSettings() {
  window.dispatchEvent(new Event(OPEN_INTERFACE_EVENT))
}

/** Opens the Accessibility window from anywhere on a dashboard (e.g. the search). */
export function openAccessibilitySettings() {
  window.dispatchEvent(new Event(OPEN_ACCESSIBILITY_EVENT))
}

export function SettingsDialog({
  open,
  onOpenChange,
  onEditProfile,
  onChangeEmail,
  onChangePassword,
  onDeleteAccount,
  onPlatformSettings,
  spotlightOptOut,
  onToggleSpotlightOptOut,
  emailNotificationsEnabled,
  onToggleEmailNotifications,
  twoFactorEnabled,
  onToggleTwoFactor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opens the full "edit profile" screen. Omit when the person can't edit the profile. */
  onEditProfile?: () => void
  /** Opens just the change-login-email screen, alongside onChangePassword. Use for accounts with no other profile fields to edit (e.g. admins). */
  onChangeEmail?: () => void
  /** Opens the change-password screen. Use this instead of onEditProfile for people who can't edit the profile. */
  onChangePassword?: () => void
  /** Opens the delete-account screen. Omit where deleting isn't offered (e.g. admin accounts). */
  onDeleteAccount?: () => void
  /** Opens platform-wide settings (maintenance mode, bank accounts, categories, withdrawal limits). Admin only. */
  onPlatformSettings?: () => void
  /** Current opt-out state for "Giver of the Month" (see 20260928000200_giver_spotlight_opt_out.sql). Givers only - pass this and onToggleSpotlightOptOut together to show the row; omit both for organizations/admins. */
  spotlightOptOut?: boolean
  onToggleSpotlightOptOut?: (next: boolean) => void | Promise<void>
  /** Whether this account gets emails for in-app notifications (see profiles.email_notifications_enabled). Pass this and onToggleEmailNotifications together to show the row; omit both to hide it (e.g. while its migration hasn't run yet). Doesn't affect account emails like email verification or password reset - those go through Supabase Auth's own mailer, never this toggle. */
  emailNotificationsEnabled?: boolean
  onToggleEmailNotifications?: (next: boolean) => void | Promise<void>
  /** Whether a correct password alone isn't enough to sign in - a code is also emailed, and must be entered, to finish (see profiles.two_factor_enabled, checked in api/login). Pass this and onToggleTwoFactor together to show the row; omit both to hide it (e.g. while its migration hasn't run yet). */
  twoFactorEnabled?: boolean
  onToggleTwoFactor?: (next: boolean) => void | Promise<void>
}) {
  const [soundOn, setSoundOn] = useState(true)
  const [soundChoice, setSoundChoice] = useState<NotificationSoundId>("chime")
  const [fontSize, setFontSize] = useState<FontSizeLevel>("normal")
  const [assistantOn, setAssistantOn] = useState(true)
  const [wakeOn, setWakeOn] = useState(false)
  const [wakeSupported, setWakeSupported] = useState(true)
  const [reduceMotion, setReduceMotionState] = useState(false)
  const [clickSounds, setClickSounds] = useState(false)
  const [clockOn, setClockOn] = useState(true)

  useEffect(() => {
    if (open) {
      setSoundOn(isNotificationSoundEnabled())
      setSoundChoice(getNotificationSoundChoice())
      setFontSize(getFontSizeLevel())
      setAssistantOn(isAssistantEnabled())
    setWakeOn(isWakeWordEnabled())
    setWakeSupported(isWakeWordSupported())
      setReduceMotionState(getReduceMotion())
      setClickSounds(isClickSoundEnabled())
      setClockOn(isClockShown())
    }
  }, [open])

  // Windows opened from here (Edit profile, Change password...) get
  // "Back to Settings" - see lib/window-return.ts.
  // The Accessibility window (font size, reduce motion, click sounds).
  const [showAccessibility, setShowAccessibility] = useState(false)
  // The User interface window (colour scheme, Lifty, clock).
  const [showInterface, setShowInterface] = useState(false)
  const [scheme, setSchemeState] = useState<ColorScheme>("default")
  useEffect(() => { if (showInterface) setSchemeState(getColorScheme()) }, [showInterface])
  const changeScheme = (next: ColorScheme) => {
    setSchemeState(next)
    setColorScheme(next)
    logClientAction("Changed settings", `Colour scheme: ${COLOR_SCHEMES.find(option => option.value === next)?.label || next}`)
  }
  useEffect(() => {
    const openIt = () => { onOpenChange(false); setShowInterface(true) }
    window.addEventListener(OPEN_INTERFACE_EVENT, openIt)
    return () => window.removeEventListener(OPEN_INTERFACE_EVENT, openIt)
  }, [onOpenChange])
  useEffect(() => {
    const openIt = () => { onOpenChange(false); setShowAccessibility(true) }
    window.addEventListener(OPEN_ACCESSIBILITY_EVENT, openIt)
    return () => window.removeEventListener(OPEN_ACCESSIBILITY_EVENT, openIt)
  }, [onOpenChange])

  const withReturn = (action?: () => void) => () => {
    setReturnTo("Settings", () => onOpenChange(true))
    action?.()
  }

  const changeFontSize = (level: FontSizeLevel) => {
    setFontSize(level)
    setFontSizeLevel(level)
    logClientAction("Changed settings", `Font size: ${level}`)
  }

  const changeClock = (next: boolean) => {
    setClockOn(next)
    setClockShown(next)
    logClientAction("Changed settings", `Clock & date turned ${next ? "on" : "off"}`)
  }

  const changeClickSounds = (next: boolean) => {
    setClickSounds(next)
    setClickSoundEnabled(next)
    logClientAction("Changed settings", `Click sounds turned ${next ? "on" : "off"}`)
    if (next) playClickSound("toggle-on") // a sample, so people hear what they've turned on
  }

  const changeReduceMotion = (next: boolean) => {
    setReduceMotionState(next)
    setReduceMotion(next)
    logClientAction("Changed settings", `Reduce motion turned ${next ? "on" : "off"}`)
  }

  const changeAssistant = (next: boolean) => {
    setAssistantOn(next)
    setAssistantEnabled(next)
    logClientAction("Changed settings", `Lifty assistant turned ${next ? "on" : "off"}`)
  }

  const changeWake = (next: boolean) => {
    setWakeOn(next)
    setWakeWordEnabled(next)
    logClientAction("Changed settings", `"Hey Lifty" turned ${next ? "on" : "off"}`)
  }

  const changeSound = (next: boolean) => {
    setSoundOn(next)
    setNotificationSoundEnabled(next)
    logClientAction("Changed settings", `Notification sounds turned ${next ? "on" : "off"}`)
    if (next) {
      // The click is the interaction browsers need before allowing sound; play a
      // sample so people hear what they've turned on.
      unlockNotificationSound()
      playNotificationSound(soundChoice)
    }
  }

  const changeSoundChoice = (id: NotificationSoundId) => {
    setSoundChoice(id)
    setNotificationSoundChoice(id)
    logClientAction("Changed settings", `Notification sound: ${NOTIFICATION_SOUNDS.find(sound => sound.id === id)?.label || id}`)
    unlockNotificationSound()
    playNotificationSound(id)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Two columns on larger screens; one column on phones. Size and the
          maximize button come from DialogContent itself. */}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account and preferences.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2 md:grid-flow-row-dense">
          {onEditProfile && (
            <SettingRow icon={<UserRound className="h-5 w-5" />} title="Edit profile" description="Update your details, contact information, email and password.">
              <Button type="button" variant="outline" size="sm" onClick={withReturn(onEditProfile)}>Edit</Button>
            </SettingRow>
          )}

          {!onEditProfile && onChangeEmail && (
            <SettingRow icon={<AtSign className="h-5 w-5" />} title="Login email" description="Change the email address you sign in with.">
              <Button type="button" variant="outline" size="sm" onClick={withReturn(onChangeEmail)}>Change</Button>
            </SettingRow>
          )}

          {!onEditProfile && onChangePassword && (
            <SettingRow icon={<KeyRound className="h-5 w-5" />} title="Change password" description="Choose a new password for your account.">
              <Button type="button" variant="outline" size="sm" onClick={withReturn(onChangePassword)}>Change</Button>
            </SettingRow>
          )}

          {onPlatformSettings && (
            <SettingRow icon={<SlidersHorizontal className="h-5 w-5" />} title="Platform settings" description="Maintenance mode, bank accounts, need categories and withdrawal limits.">
              <Button type="button" variant="outline" size="sm" onClick={withReturn(onPlatformSettings)} data-tip="Open maintenance mode, bank accounts, need categories and withdrawal limits">Open</Button>
            </SettingRow>
          )}

          <div className="md:col-span-2" data-setting="Passkeys">
            <PasskeySettings open={open} />
          </div>

          {onToggleTwoFactor && (
            <SettingRow
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Two-factor sign-in"
              description={
                twoFactorEnabled
                  ? "On - after your password, we also email a code you must enter to finish signing in. Doesn't apply to Google/LinkedIn/Microsoft sign-in."
                  : "Off - your password alone signs you in. Turn on for an extra emailed code at every sign-in."
              }
            >
              <Switch
                checked={!!twoFactorEnabled}
                onCheckedChange={onToggleTwoFactor}
                aria-label="Two-factor sign-in"
                data-tip={twoFactorEnabled ? "Turn off to sign in with just your password" : "Turn on to require an emailed code at every sign-in"}
              />
            </SettingRow>
          )}

          <SettingRow icon={<Bell className="h-5 w-5" />} title="Notification sounds" description={soundOn ? "A sound plays when a new notification arrives." : "Muted. No sound for new notifications."}>
            <Switch checked={soundOn} onCheckedChange={changeSound} aria-label="Notification sounds" />
          </SettingRow>

          {soundOn && (
            <div className="rounded border border-slate-200 dark:border-[#233350] p-4 md:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Choose a sound</p>
              <div className="flex flex-wrap gap-1.5">
                {NOTIFICATION_SOUNDS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => changeSoundChoice(option.id)}
                    aria-pressed={soundChoice === option.id}
                    data-tip={`Preview and use the "${option.label}" notification sound`}
                    className={`rounded px-3 py-1.5 text-xs font-bold transition-colors ${
                      soundChoice === option.id
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 dark:border-[#233350] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1A2740]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onToggleEmailNotifications && (
            <SettingRow
              icon={<Mail className="h-5 w-5" />}
              title="Email notifications"
              description={
                emailNotificationsEnabled
                  ? "You'll get an email for every notification (messages, donations, badges and more), same as they appear in-app."
                  : "Off - notifications still appear in-app, but you won't get emails for them. Account emails (like signing in) are unaffected."
              }
            >
              <Switch
                checked={!!emailNotificationsEnabled}
                onCheckedChange={onToggleEmailNotifications}
                aria-label="Email notifications"
                data-tip={emailNotificationsEnabled ? "Turn off to stop getting emails for notifications" : "Turn on to get emails for notifications again"}
              />
            </SettingRow>
          )}

          <SettingRow
            icon={<Mic className="h-5 w-5" />}
            title={'"Hey Lifty"'}
            description={
              !wakeSupported
                ? "Not available in this browser. Use Chrome or Edge on a computer or Android phone."
                : wakeOn
                  ? "Say \"Hey Lifty\" and Lifty opens and listens - no clicking. The microphone listens only while HelpLift is open and Lifty is closed; in Chrome and Edge your browser's speech service processes the audio."
                  : "Off. Turn on to open Lifty hands-free by saying \"Hey Lifty\". Your browser will ask to use the microphone."
            }
          >
            <Switch
              checked={wakeOn && wakeSupported}
              onCheckedChange={changeWake}
              disabled={!wakeSupported || !assistantOn}
              aria-label="Hey Lifty voice wake"
              data-tip={!assistantOn ? "Turn Lifty on first" : wakeOn ? "Stop listening for \"Hey Lifty\"" : "Listen for \"Hey Lifty\""}
            />
          </SettingRow>

          {/* User interface opens its own window: colour scheme, Lifty and the clock. */}
          <SettingRow icon={<Palette className="h-5 w-5" />} title="User interface" description="Colour scheme, Lifty and the clock, on this device.">
            <Button type="button" variant="outline" size="sm" onClick={withReturn(() => { onOpenChange(false); setShowInterface(true) })} data-tip="Open colour scheme, Lifty and clock settings">Open</Button>
          </SettingRow>

          {/* Accessibility opens its own window, like Platform settings does for admins. */}
          <SettingRow icon={<Accessibility className="h-5 w-5" />} title="Accessibility" description="Font size, reduce motion and click sounds, on this device.">
            <Button type="button" variant="outline" size="sm" onClick={withReturn(() => { onOpenChange(false); setShowAccessibility(true) })} data-tip="Open font size, reduce motion and click sounds">Open</Button>
          </SettingRow>

          <SettingRow icon={<BookOpen className="h-5 w-5" />} title="User manual" description="A step-by-step guide to everything on HelpLift, as a PDF.">
            <Button asChild variant="outline" size="sm">
              <a href="/helplift-user-manual.pdf" download="HelpLift User Manual.pdf" data-tip="Download the HelpLift user manual (PDF)">
                <Download className="h-4 w-4" /> Download
              </a>
            </Button>
          </SettingRow>

          {onToggleSpotlightOptOut && (
            <SettingRow
              icon={<Star className="h-5 w-5" />}
              title="Giver of the Month"
              description={
                spotlightOptOut
                  ? "Off - you're excluded and will never be shown, even if you'd otherwise qualify."
                  : "Privacy note: if you're picked, your full name and profile picture are shown publicly on the homepage - visible to everyone, not just signed-in users - along with how many needs you supported that month."
              }
            >
              <Switch
                checked={!spotlightOptOut}
                onCheckedChange={(checked) => onToggleSpotlightOptOut(!checked)}
                aria-label="Eligible for Giver of the Month"
                data-tip={spotlightOptOut ? "Turn on to become eligible again" : "Turn off to opt out completely - your name and picture will never be shown"}
              />
            </SettingRow>
          )}

          {onDeleteAccount && (
            <div className="md:col-span-2">
            <SettingRow danger icon={<Trash2 className="h-5 w-5" />} title="Delete account" description="Permanently delete your account and its data. This can't be undone.">
              <button type="button" onClick={withReturn(onDeleteAccount)} className="btn-delete btn-delete--label h-9">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </SettingRow>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showAccessibility} onOpenChange={setShowAccessibility}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Accessibility className="h-5 w-5 text-blue-600" /> Accessibility</DialogTitle>
          <DialogDescription>
            Make HelpLift easier to read and use on this device. For dark, high-contrast or grayscale colours, use the theme button at the top of the page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
            <SettingRow
              icon={<MousePointerClick className="h-5 w-5" />}
              title="Click sounds"
              description={clickSounds ? "On - a soft click plays when you press buttons, links and tabs, on this device." : "Off - turn on to hear a soft click when you press buttons, links and tabs."}
            >
              <Switch
                checked={clickSounds}
                onCheckedChange={changeClickSounds}
                aria-label="Click sounds"
                data-tip={clickSounds ? "Turn click sounds off" : "Play a soft click on every press"}
              />
            </SettingRow>

            <SettingRow
              icon={<Sparkles className="h-5 w-5" />}
              title="Reduce motion"
              description={reduceMotion ? "On - animations and transitions are switched off, on this device." : "Off - tabs and panels animate smoothly. Turn on if motion is distracting or uncomfortable."}
            >
              <Switch
                checked={reduceMotion}
                onCheckedChange={changeReduceMotion}
                aria-label="Reduce motion"
                data-tip={reduceMotion ? "Turn animations back on" : "Switch off animations and transitions"}
              />
            </SettingRow>

            <SettingRow icon={<Type className="h-5 w-5" />} title="Font size" description="Makes text larger across the whole site, on this device.">
              <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] p-1">
                {FONT_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeFontSize(option.value)}
                    aria-label={option.label}
                    aria-pressed={fontSize === option.value}
                    data-tip={option.label}
                    style={{ fontSize: option.size }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full font-bold transition-colors ${
                      fontSize === option.value
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
                    }`}
                  >
                    A
                  </button>
                ))}
              </div>
            </SettingRow>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={showInterface} onOpenChange={setShowInterface}>
      {/* Don't put the cursor on the first scheme tile when the window opens
          (it drew a focus outline there); Tab still reaches every tile. */}
      <DialogContent onOpenAutoFocus={event => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-blue-600" /> User interface</DialogTitle>
          <DialogDescription>
            How your dashboard looks and what it shows, on this device. Light and dark mode are on the theme button at the top of the page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
          {/* The row keeps its natural height (not h-full), so the tiles sit below it. */}
          <div className="md:col-span-2 [&>[data-setting]]:h-auto" data-setting="Colour scheme">
            <SettingRow icon={<Palette className="h-5 w-5" />} title="Colour scheme" description="Restyles the whole dashboard - colours, surfaces and backgrounds - in light and dark mode.">
              <span className="sr-only">Choose below</span>
            </SettingRow>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4" role="radiogroup" aria-label="Colour scheme">
              {COLOR_SCHEMES.map(option => {
                const selected = scheme === option.value
                const { accent, light, dark } = option.preview
                const gradient = `linear-gradient(135deg, ${accent[0]}, ${accent[1]})`
                // A tiny dashboard: a panel with a title bar, two text lines and an accent button.
                const mini = ([page, panel, line]: readonly string[], text: string) => (
                  <span className="flex flex-1 flex-col gap-1.5 p-2" style={{ background: page }}>
                    <span className="h-1.5 w-8 rounded-full" style={{ background: gradient }} />
                    <span className="flex flex-col gap-1 rounded-md p-1.5 shadow-sm" style={{ background: panel }}>
                      <span className="h-1 w-full rounded-full" style={{ background: text, opacity: 0.55 }} />
                      <span className="h-1 w-2/3 rounded-full" style={{ background: line }} />
                      <span className="mt-0.5 h-2.5 w-10 rounded-full" style={{ background: gradient }} />
                    </span>
                  </span>
                )
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => changeScheme(option.value)}
                    data-tip={option.description}
                    className={`group relative flex flex-col gap-2.5 rounded-2xl p-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                      selected ? "bg-white dark:bg-slate-900 shadow-xl" : "bg-slate-100 dark:bg-[#1A2740] hover:shadow-md"
                    }`}
                    style={selected ? { boxShadow: `0 10px 28px -10px ${accent[0]}99` } : undefined}
                  >
                    {/* Light and dark mode side by side. */}
                    <span className="flex h-20 w-full overflow-hidden rounded-xl">
                      {mini(light, "#0f172a")}
                      {mini(dark, "#ffffff")}
                    </span>
                    <span className="flex w-full items-center justify-between gap-2 px-1">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: gradient }} />
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{option.description}</span>
                      </span>
                      {selected && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: gradient }}>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
            <SettingRow
              icon={<Bot className="h-5 w-5" />}
              title="Lifty (AI assistant)"
              description={assistantOn ? "Lifty's chat button shows on every page, on this device." : "Hidden on this device. Turn on to bring Lifty back."}
            >
              <Switch
                checked={assistantOn}
                onCheckedChange={changeAssistant}
                aria-label="Lifty (AI assistant)"
                data-tip={assistantOn ? "Hide Lifty on every page" : "Show Lifty again"}
              />
            </SettingRow>

            <SettingRow
              icon={<Clock className="h-5 w-5" />}
              title="Clock & date"
              description={clockOn ? "Shown at the top of your dashboard, on this device." : "Hidden on this device. Turn on to show the clock and date again."}
            >
              <Switch
                checked={clockOn}
                onCheckedChange={changeClock}
                aria-label="Show clock and date"
                data-tip={clockOn ? "Hide the clock and date" : "Show the clock and date"}
              />
            </SettingRow>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
