// Labels for the admin Live activity tab, for actions that go through an API
// route which doesn't log itself (components/activity-tracker.tsx reports
// each successful POST/PATCH/PUT/DELETE to /api/... and app/api/activity
// turns it into one of these). Matching happens on the server, so the browser
// only says which route succeeded - it can't write its own label. Routes not
// listed here are ignored: either they log their own action already (with
// more detail), happen before sign-in, or are background noise.
//
// Path segments that are ids or tokens are replaced with [id] before matching.

const LABELS: { method: string; pattern: RegExp; label: string }[] = [
  // Admin
  { method: "POST", pattern: /^\/api\/admin\/announcements$/, label: "Sent an announcement" },
  { method: "POST", pattern: /^\/api\/admin\/bank-accounts$/, label: "Added a platform bank account" },
  { method: "PATCH", pattern: /^\/api\/admin\/bank-accounts\/\[id\]$/, label: "Updated a platform bank account" },
  { method: "DELETE", pattern: /^\/api\/admin\/bank-accounts\/\[id\]$/, label: "Removed a platform bank account" },
  { method: "PATCH", pattern: /^\/api\/admin\/developer-reports\/\[id\]$/, label: "Updated a developer report" },
  { method: "POST", pattern: /^\/api\/admin\/donations\/\[id\]\/receipt$/, label: "Sent a donation receipt" },
  { method: "PATCH", pattern: /^\/api\/admin\/donations\/\[id\]$/, label: "Updated a donation" },
  { method: "DELETE", pattern: /^\/api\/admin\/fulfillments\/\[id\]$/, label: "Removed a fulfilment" },
  { method: "PATCH", pattern: /^\/api\/admin\/gifts\/claims\/\[id\]$/, label: "Updated a gift claim" },
  { method: "DELETE", pattern: /^\/api\/admin\/gifts\/claims\/\[id\]$/, label: "Removed a gift claim" },
  { method: "PATCH", pattern: /^\/api\/admin\/gifts\/\[id\]$/, label: "Updated a gift" },
  { method: "POST", pattern: /^\/api\/admin\/invitations$/, label: "Invited an administrator" },
  { method: "DELETE", pattern: /^\/api\/admin\/invitations\/\[id\]$/, label: "Cancelled an admin invite" },
  { method: "POST", pattern: /^\/api\/admin\/need-categories$/, label: "Added a need category" },
  { method: "PATCH", pattern: /^\/api\/admin\/need-categories\/\[id\]$/, label: "Edited a need category" },
  { method: "DELETE", pattern: /^\/api\/admin\/need-categories\/\[id\]$/, label: "Removed a need category" },
  { method: "PATCH", pattern: /^\/api\/admin\/needs\/\[id\]$/, label: "Updated a need" },
  { method: "DELETE", pattern: /^\/api\/admin\/needs\/\[id\]$/, label: "Deleted a need" },
  { method: "PATCH", pattern: /^\/api\/admin\/profile$/, label: "Updated their admin profile" },
  { method: "PATCH", pattern: /^\/api\/admin\/settings$/, label: "Changed platform settings" },
  { method: "PATCH", pattern: /^\/api\/admin\/spotlights$/, label: "Updated the spotlights" },
  { method: "PATCH", pattern: /^\/api\/admin\/stories\/\[id\]$/, label: "Moderated an impact story" },
  { method: "PATCH", pattern: /^\/api\/admin\/users\/\[id\]\/team$/, label: "Changed an organization's team" },
  { method: "POST", pattern: /^\/api\/admin\/withdrawals\/\[id\]\/proof$/, label: "Uploaded proof of a payout" },
  { method: "PATCH", pattern: /^\/api\/admin\/withdrawals\/\[id\]$/, label: "Updated a withdrawal request" },
  { method: "POST", pattern: /^\/api\/admin-invitations\/\[id\]\/accept$/, label: "Accepted an admin invite" },

  // Givers
  { method: "POST", pattern: /^\/api\/giver\/avatar$/, label: "Changed their profile photo" },
  { method: "DELETE", pattern: /^\/api\/giver\/avatar$/, label: "Removed their profile photo" },
  { method: "POST", pattern: /^\/api\/giver\/donations\/\[id\]\/cancel$/, label: "Cancelled a donation" },
  { method: "DELETE", pattern: /^\/api\/giver\/donations\/\[id\]\/proof\/\[id\]$/, label: "Removed a proof of payment" },
  { method: "PATCH", pattern: /^\/api\/giver\/donations\/\[id\]$/, label: "Updated a donation" },
  { method: "POST", pattern: /^\/api\/giver\/gifts\/analyze-photo$/, label: "Used Snap to pledge" },
  { method: "PATCH", pattern: /^\/api\/giver\/profile$/, label: "Updated their profile" },

  // Organizations
  { method: "POST", pattern: /^\/api\/organization\/documents$/, label: "Uploaded a verification document" },
  { method: "DELETE", pattern: /^\/api\/organization\/documents\/\[id\]$/, label: "Removed a verification document" },
  { method: "POST", pattern: /^\/api\/organization\/needs\/draft$/, label: "Used the AI need writer" },
  { method: "PATCH", pattern: /^\/api\/organization\/profile$/, label: "Updated the organization profile" },
  { method: "POST", pattern: /^\/api\/organization\/stories\/\[id\]\/media$/, label: "Added photos to a story" },
  { method: "DELETE", pattern: /^\/api\/organization\/stories\/\[id\]\/media\/\[id\]$/, label: "Removed a photo from a story" },
  { method: "PATCH", pattern: /^\/api\/organization\/stories\/\[id\]$/, label: "Edited an impact story" },
  { method: "DELETE", pattern: /^\/api\/organization\/stories\/\[id\]$/, label: "Deleted an impact story" },
  { method: "POST", pattern: /^\/api\/organization\/team$/, label: "Invited a team member" },
  { method: "DELETE", pattern: /^\/api\/organization\/team\/invitations\/\[id\]$/, label: "Cancelled a team invite" },
  { method: "PATCH", pattern: /^\/api\/organization\/team\/members\/\[id\]$/, label: "Changed a team member's role" },
  { method: "DELETE", pattern: /^\/api\/organization\/team\/members\/\[id\]$/, label: "Removed a team member" },
  { method: "PATCH", pattern: /^\/api\/organization\/withdrawals\/\[id\]$/, label: "Updated a withdrawal request" },
  { method: "POST", pattern: /^\/api\/invitations\/\[id\]\/accept$/, label: "Joined an organization's team" },

  // Everyone
  { method: "POST", pattern: /^\/api\/assistant$/, label: "Asked Lifty a question" },
  { method: "POST", pattern: /^\/api\/contact$/, label: "Sent a contact message" },
  { method: "POST", pattern: /^\/api\/fulfillments\/\[id\]\/proofs$/, label: "Uploaded proof of delivery" },
  { method: "PATCH", pattern: /^\/api\/fulfillments\/\[id\]$/, label: "Updated a delivery" },
  { method: "PATCH", pattern: /^\/api\/notifications\/read-all$/, label: "Marked all notifications as read" },
  { method: "PATCH", pattern: /^\/api\/notifications\/\[id\]$/, label: "Read a notification" },
  { method: "POST", pattern: /^\/api\/public\/donations\/platform$/, label: "Started a donation to HelpLift" },
  { method: "PATCH", pattern: /^\/api\/public\/donations\/platform\/\[id\]$/, label: "Updated a donation to HelpLift" },
  { method: "POST", pattern: /^\/api\/public\/donations\/platform\/\[id\]\/cancel$/, label: "Cancelled a donation to HelpLift" },
  { method: "POST", pattern: /^\/api\/register\/choose-role$/, label: "Chose their account type" },
  { method: "POST", pattern: /^\/api\/register\/complete$/, label: "Finished registration" },
]

// UUIDs, numeric ids and long tokens become [id].
function normalise(path: string) {
  return path
    .split(/[?#]/)[0]
    .split("/")
    .map(segment => (/^[0-9a-f-]{32,36}$/i.test(segment) || /^\d+$/.test(segment) || /^[A-Za-z0-9_-]{20,}$/.test(segment) ? "[id]" : segment))
    .join("/")
}

export function labelForApiAction(method: unknown, path: unknown): string | null {
  if (typeof method !== "string" || typeof path !== "string" || !path.startsWith("/api/")) return null
  const normalised = normalise(path)
  const upper = method.toUpperCase()
  return LABELS.find(entry => entry.method === upper && entry.pattern.test(normalised))?.label ?? null
}
