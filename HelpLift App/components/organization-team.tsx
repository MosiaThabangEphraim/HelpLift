"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Copy, Loader2, Mail, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ROLE_LABELS, type OrgRole } from "@/lib/organization-access"

type Member = { id: string; profile_id: string; role: OrgRole; name: string | null; email: string | null; is_primary: boolean; is_you: boolean }
type PendingInvite = { id: string; email: string; role: OrgRole; expires_at: string }

const ROLE_HELP: Record<OrgRole, string> = {
  owner: "Full access, including managing the team, organization profile and banking details.",
  manager: "Create and edit needs; handle interests, fulfillments, stories, documents and gift claims.",
  viewer: "Read-only access to needs, interests, donations and fulfillments.",
}

const selectClass =
  "rounded-xl border border-slate-200 dark:border-[#233350] bg-white dark:bg-[#0B1220] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

// Owner-only team management: invite by email, change roles, remove members,
// revoke pending invitations. All authorization is enforced by the API routes.
export function OrganizationTeam() {
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<PendingInvite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("manager")
  const [isInviting, setIsInviting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string; link?: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/organization/team")
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setMembers(data.members || [])
      setInvitations(data.invitations || [])
    } else {
      setFeedback({ type: "error", text: data.message || "Could not load your team." })
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)
    setFeedback(null)
    const res = await fetch("/api/organization/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setFeedback({
        type: "success",
        text: data.email_sent
          ? `Invitation emailed to ${email}. If it doesn't arrive (check their spam or junk folder), you can send them this link yourself:`
          : `The invitation was created but the email couldn't be sent. Share this link with ${email} yourself:`,
        // Always offered: an accepted email can still be filtered by the recipient's server.
        link: data.invite_url,
      })
      setEmail("")
      load()
    } else {
      setFeedback({ type: "error", text: data.message || "Could not send the invitation." })
    }
    setIsInviting(false)
  }

  const changeRole = async (member: Member, newRole: OrgRole) => {
    setFeedback(null)
    const res = await fetch(`/api/organization/team/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not update the role." })
    load()
  }

  const removeMember = async (member: Member) => {
    if (!window.confirm(`Permanently remove ${member.name || member.email || "this member"}? Their HelpLift account will be deleted and can’t be recovered. Documents they uploaded for your organization are kept.`)) return
    setFeedback(null)
    const res = await fetch(`/api/organization/team/members/${member.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not remove the member." })
    load()
  }

  const revokeInvite = async (inv: PendingInvite) => {
    setFeedback(null)
    const res = await fetch(`/api/organization/team/invitations/${inv.id}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setFeedback({ type: "error", text: data.message || "Could not revoke the invitation." })
    load()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader>
          <CardTitle>Invite a teammate</CardTitle>
          <CardDescription>They'll get an email with a link to join your organization with the role you choose.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedback && (
            <div className={`p-3 rounded-2xl text-sm font-semibold flex items-start gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
            }`}>
              {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="space-y-2 min-w-0">
                <p>{feedback.text}</p>
                {feedback.link && (
                  <div className="flex items-center gap-2">
                    <code className="text-xs break-all">{feedback.link}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(feedback.link!)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Copy link">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <form onSubmit={invite} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-role">Role</Label>
              <select id="invite-role" value={role} onChange={e => setRole(e.target.value as any)} className={`${selectClass} w-full`}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ROLE_HELP[role]}</p>
            </div>
            <Button type="submit" disabled={isInviting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Send invitation
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your team</CardTitle>
          <CardDescription>Owners can invite people, change roles and remove members. Removing someone permanently deletes their account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 dark:divide-[#233350]">
                {members.map(member => (
                  <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{member.name || member.email || "Team member"}{member.is_you && <span className="ml-1.5 text-xs font-medium text-slate-400">(you)</span>}</p>
                      {member.name && member.email && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>}
                    </div>
                    {member.is_primary ? (
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shrink-0" title="The original account holder can’t be demoted or removed">{ROLE_LABELS.owner} · account holder</span>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <select value={member.role} onChange={e => changeRole(member, e.target.value as any)} className={selectClass} aria-label={`Role for ${member.name || member.email}`}>
                          <option value="owner">Owner</option>
                          <option value="manager">Manager</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {!member.is_you && (
                          <button onClick={() => removeMember(member)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" aria-label="Remove member and delete their account">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Pending invitations</h4>
                {invitations.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No pending invitations.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-[#233350]">
                    {invitations.map(inv => (
                      <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{inv.email}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {ROLE_LABELS[inv.role]} · expires {new Date(inv.expires_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button onClick={() => revokeInvite(inv)} className="text-xs font-bold text-red-600 hover:underline shrink-0">Revoke</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
