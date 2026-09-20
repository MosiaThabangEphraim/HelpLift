"use client"

import { useEffect, useState } from "react"
import { Bell, KeyRound, Trash2, UserRound } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  isNotificationSoundEnabled,
  playNotificationSound,
  setNotificationSoundEnabled,
  unlockNotificationSound,
} from "@/lib/notification-sound"

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
  onChangePassword,
  onDeleteAccount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opens the full "edit profile" screen. Omit when the person can't edit the profile. */
  onEditProfile?: () => void
  /** Opens the change-password screen. Use this instead of onEditProfile for people who can't edit the profile. */
  onChangePassword?: () => void
  onDeleteAccount: () => void
}) {
  const [soundOn, setSoundOn] = useState(true)

  useEffect(() => {
    if (open) setSoundOn(isNotificationSoundEnabled())
  }, [open])

  const changeSound = (next: boolean) => {
    setSoundOn(next)
    setNotificationSoundEnabled(next)
    if (next) {
      // The click is the interaction browsers need before allowing sound; play a
      // sample so people hear what they've turned on.
      unlockNotificationSound()
      playNotificationSound()
    }
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

          {!onEditProfile && onChangePassword && (
            <SettingRow icon={<KeyRound className="h-5 w-5" />} title="Change password" description="Choose a new password for your account.">
              <Button type="button" variant="outline" size="sm" onClick={onChangePassword}>Change</Button>
            </SettingRow>
          )}

          <SettingRow icon={<Bell className="h-5 w-5" />} title="Notification sounds" description={soundOn ? "A chime plays when a new notification arrives." : "Muted. No sound for new notifications."}>
            <Switch checked={soundOn} onCheckedChange={changeSound} aria-label="Notification sounds" />
          </SettingRow>

          <SettingRow danger icon={<Trash2 className="h-5 w-5" />} title="Delete account" description="Permanently delete your account and its data. This can't be undone.">
            <Button type="button" variant="outline" size="sm" onClick={onDeleteAccount} className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40">
              Delete
            </Button>
          </SettingRow>
        </div>
      </DialogContent>
    </Dialog>
  )
}
