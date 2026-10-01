"use client"

import { useEffect, useState } from "react"
import { AtSign, Bell, KeyRound, Mail, ShieldCheck, SlidersHorizontal, Star, Trash2, Type, UserRound } from "lucide-react"
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
    <div className={`flex items-center gap-4 rounded-2xl border p-4 ${danger ? "border-red-200 dark:border-red-900/60" : "border-slate-200 dark:border-[#233350]"}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? "bg-red-50 dark:bg-red-950/40 text-red-600" : "bg-slate-100 dark:bg-[#1A2740] text-slate-600 dark:text-slate-300"}`}>
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

  useEffect(() => {
    if (open) {
      setSoundOn(isNotificationSoundEnabled())
      setSoundChoice(getNotificationSoundChoice())
      setFontSize(getFontSizeLevel())
    }
  }, [open])

  const changeFontSize = (level: FontSizeLevel) => {
    setFontSize(level)
    setFontSizeLevel(level)
  }

  const changeSound = (next: boolean) => {
    setSoundOn(next)
    setNotificationSoundEnabled(next)
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
    unlockNotificationSound()
    playNotificationSound(id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account and preferences.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {onEditProfile && (
            <SettingRow icon={<UserRound className="h-5 w-5" />} title="Edit profile" description="Update your details, contact information, email and password.">
              <Button type="button" variant="outline" size="sm" onClick={onEditProfile}>Edit</Button>
            </SettingRow>
          )}

          {!onEditProfile && onChangeEmail && (
            <SettingRow icon={<AtSign className="h-5 w-5" />} title="Login email" description="Change the email address you sign in with.">
              <Button type="button" variant="outline" size="sm" onClick={onChangeEmail}>Change</Button>
            </SettingRow>
          )}

          {!onEditProfile && onChangePassword && (
            <SettingRow icon={<KeyRound className="h-5 w-5" />} title="Change password" description="Choose a new password for your account.">
              <Button type="button" variant="outline" size="sm" onClick={onChangePassword}>Change</Button>
            </SettingRow>
          )}

          {onPlatformSettings && (
            <SettingRow icon={<SlidersHorizontal className="h-5 w-5" />} title="Platform settings" description="Maintenance mode, bank accounts, need categories and withdrawal limits.">
              <Button type="button" variant="outline" size="sm" onClick={onPlatformSettings} data-tip="Open maintenance mode, bank accounts, need categories and withdrawal limits">Open</Button>
            </SettingRow>
          )}

          <PasskeySettings open={open} />

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
            <div className="rounded-2xl border border-slate-200 dark:border-[#233350] p-4 -mt-1">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Choose a sound</p>
              <div className="flex flex-wrap gap-1.5">
                {NOTIFICATION_SOUNDS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => changeSoundChoice(option.id)}
                    aria-pressed={soundChoice === option.id}
                    data-tip={`Preview and use the "${option.label}" notification sound`}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
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

          <SettingRow icon={<Type className="h-5 w-5" />} title="Font size" description="Makes text larger across the whole site, on this device.">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-[#233350] p-1">
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
            <SettingRow danger icon={<Trash2 className="h-5 w-5" />} title="Delete account" description="Permanently delete your account and its data. This can't be undone.">
              <Button type="button" variant="outline" size="sm" onClick={onDeleteAccount} className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">
                Delete
              </Button>
            </SettingRow>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
