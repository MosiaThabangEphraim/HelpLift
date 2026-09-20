// All tooltip wording for the site lives here. <SiteTooltips /> (mounted in the
// root layout) looks up the label of whatever button, tab or badge is hovered or
// focused and shows the matching text.
//
// Keys are the visible label, lower-cased, with any trailing count removed
// (e.g. "Interests3" -> "interests"). An entry prefixed with an area
// ("admin:", "org:", "giver:") only applies in that dashboard and wins over the
// unprefixed one, so the same word can explain different things in different
// places (e.g. "Needs" for an admin vs. for an organization).
//
// To add or change a tooltip, edit this file. For one-off cases you can also put
// data-tip="..." directly on any element.

export type TooltipArea = "admin" | "org" | "giver" | "site"

export const TOOLTIP_LABELS: Record<string, string> = {
  // --- Account & navigation
  "sign out": "Sign out of your HelpLift account",
  "log out": "Sign out of your HelpLift account",
  "log in": "Sign in to your account",
  "sign in": "Sign in with your email and password",
  "sign in with google": "Sign in with your Google account. If you're new, you'll finish registering with your details and a password first",
  "sign up with google": "Google verifies your email; you then complete the normal registration details and choose a password",
  "complete registration": "Save your details and password to finish creating your account",
  "sign in to admin panel": "Sign in to the administrator dashboard",
  "sign in as admin": "Go to the administrator sign-in page",
  "create an account": "Register as a giver or as an organization",
  "forgot password?": "Get an email to reset your password",
  "update password": "Save your new password",
  "change password": "Change your account password",
  "change": "Change your login email address",
  "send verification code": "We'll email you a code to confirm it's really you",
  "confirm new email": "Confirm and switch to the new email address",
  "delete my account": "Permanently delete your account and its data. This can't be undone",
  "delete this account": "Permanently delete this account and its data. This can't be undone",
  "permanently delete my account": "Permanently delete your account and its data. This can't be undone",
  "settings": "Edit your profile, change your password, mute notification sounds or delete your account",
  "edit profile": "Update your name, phone number, preferences and profile picture",
  "upload photo": "Choose a picture to use as your profile photo",
  "change photo": "Choose a different profile photo",
  "edit": "Edit this item",
  "delete": "Permanently delete this item",
  "cancel": "Close without saving",
  "close": "Close this window",
  "back": "Go back to the page you were on",
  "✕": "Close",
  "remove": "Remove this item",
  "dismiss message": "Dismiss this message",
  "notifications": "See your notifications and messages",
  "switch to light mode": "Switch to the light theme",
  "switch to dark mode": "Switch to the dark theme",
  "save changes": "Save your changes",
  "export": "Download this list as a spreadsheet (CSV)",
  "reset to all time": "Clear the date filter and show everything",
  "reset all filters": "Clear the search and all filters",
  "try again": "Try that again",

  // --- Messaging
  "message": "Send a message to this person",
  "inbox": "Messages sent to you",
  "sent": "Conversations you've sent messages in. Open one to see the whole history",
  "reply": "Reply to this message. It's sent as a new notification with this message quoted",
  "message admin": "Contact a HelpLift administrator",
  "message organization": "Send a message to this organization",
  "announcement": "Send one message to many users at once",
  "send request": "Send your request to the HelpLift team",

  // --- Giving (givers)
  "support this need": "Tell the organization you'd like to help with this need",
  "express interest": "Tell the organization you'd like to help with this need",
  "submit interest": "Send your offer to help to the organization",
  "donate money": "Give money to this need by bank transfer or PayFast",
  "pledge a gift": "Offer goods or services that organizations can claim",
  "pledge an offering": "Offer goods or services that organizations can claim",
  "submit gift pledge": "Send your offering to an administrator for approval",
  "i'll do this later": "Skip for now. You can finish this later from your donations",
  "view public board": "See every open need on the public board",
  "organizations": "Browse and message the verified organizations on HelpLift",
  "view details": "See this organization's full profile, needs and stories",
  "reset filters": "Clear the search and all filters",
  "browse needs": "See every open need on the public board",
  "browse community needs": "See every open need on the public board",
  "view open needs": "See every open need on the public board",
  "explore all needs": "See every open need on the public board",

  // --- Organization actions
  "public profile": "See how your organization looks to the public (opens in a new tab)",
  "save draft": "Save this need as a draft. It goes public once an administrator approves it",
  "mark fulfilled": "Mark this need as fully met. It closes on the public board",
  "close need": "Close this need without marking it fulfilled",
  "accept": "Accept this offer of support. A fulfillment is created to track delivery",
  "decline": "Decline this offer of support",
  "start delivery": "Mark that delivery of the support has begun",
  "verify & complete": "Upload proof and mark this delivery as completed",
  "verify & mark completed": "Upload proof and mark this delivery as completed",
  "upload document": "Upload this verification document for admin review",
  "+ add another document": "Attach another verification document",
  "resubmit for review": "Send the organization back to an administrator for another review (owners only)",
  "publish impact story": "Submit this story. It goes public once an administrator approves it",
  "upload to story": "Add these photos to the story",
  "claim for organization": "Ask to receive this gift for your organization. An administrator approves claims",
  "confirm & claim": "Submit your claim for administrator review",
  "thank the donor": "Send a thank-you message to the donor",
  "preview receipt": "Preview the receipt the donor will receive",
  "send invitation": "Email an invitation to join your organization's team",
  "revoke": "Cancel this invitation. Its link stops working",
  "accept invitation": "Join the organization's team with the role you were invited as",
  "create account and join": "Create your account and join the team with the role you were invited as",
  "sign in and join": "Sign in and join the team with the role you were invited as",
  "sign out and continue": "Sign out so you can continue with the invited email address",

  // --- Admin actions
  "add admin": "Create another administrator account",
  "approve & publish": "Approve this and make it public",
  "approve": "Approve this request",
  "reject": "Reject this. You can add a message explaining why",
  "unpublish": "Take this off the public site and send it back for review",
  "confirm reject": "Confirm the rejection",
  "confirm decline": "Confirm declining this claim",
  "request info": "Ask the organization for more information before you decide",
  "approve claim": "Confirm that the organization receives this gift",
  "reject claim": "Decline this claim. The gift goes back to the Gift Library",
  "reject listing": "Reject this gift offering",
  "awaiting review": "Show only the items still waiting for your decision",
  "all stories": "Show every impact story, whatever its status",
  "view": "See more details",
  "details": "See more details",
  "read full story": "Read the whole story",

  // --- Status badges & roles
  "awaiting approval": "Waiting for an administrator to approve this before it goes public",
  "awaiting admin approval": "Waiting for an administrator to approve this before it goes public",
  "high urgency": "This need is urgent",
  "standard": "Standard urgency",
  "pending verification": "Proof of payment was submitted and is waiting for an administrator to check it",
  "awaiting payment": "The giver hasn't uploaded proof of payment yet",
  "published": "Approved and visible to the public",
  "rejected": "An administrator rejected this",
  "owner": "Full access, including the team, organization profile and banking details",
  "manager": "Can manage needs, interests, fulfillments, stories and messages",
  "viewer": "Read-only access",
  "owner · account holder": "The original account holder. Can't be demoted or removed",

  // --- Dashboard tabs: administrator
  "admin:organizations": "Review and approve organizations",
  "admin:needs": "Approve or reject needs before they go public",
  "admin:gift library": "Approve gift offerings and review claims",
  "admin:interests": "Review offers of support from givers",
  "admin:donations": "Verify donations and send receipts",
  "admin:impact stories": "Approve or reject impact stories before they go public",
  "admin:fulfillments": "See deliveries and the proof attached to them",
  "admin:users": "Manage user accounts and administrators",
  "admin:messages": "Messages sent to administrators",
  "admin:feedback": "Ratings and improvement ideas sent by givers and organizations",
  "admin:reports": "Platform statistics and exports",

  // --- Dashboard tabs: organization
  "org:needs": "Create needs and manage the ones you've posted",
  "org:fulfillments": "Track deliveries and add proof that they were completed",
  "org:interests": "Offers of support from givers",
  "org:donations": "Money donations to your organization (view only)",
  "org:messages": "Messages from givers and administrators",
  "org:impact stories": "Share stories about your impact. Administrators approve them first",
  "org:gift library": "Free gifts that givers offer and your organization can claim",
  "org:documents": "Verification documents for your organization (owners upload)",
  "org:team": "Invite teammates and manage their roles (owners only)",
  "org:analytics": "Charts of funds received, offers of support, needs and deliveries",

  // --- Dashboard tabs: giver
  "giver:fulfillments": "Your accepted offers and how their delivery is going",
  "giver:my interests": "Needs you've offered to help with",
  "giver:my donations": "Your money donations and their status",
  "giver:gift library": "Gifts you've offered and gifts available to organizations",
  "giver:messages": "Messages from organizations and administrators",
  "giver:analytics": "Charts of your giving, your offers of help and their progress",
  "view as table": "Show the numbers behind this chart",
  "view as chart": "Go back to the chart",
  "last 6 months": "Show only the last 6 months",
  "last 12 months": "Show only the last 12 months",
  "all time": "Show everything since you started",
}

// Labels with changing parts (counts, names) are matched by pattern.
export const TOOLTIP_PATTERNS: [RegExp, string][] = [
  [/^export /, "Download this data as a spreadsheet (CSV) for the time range you've chosen"],
  [/^view documents/, "See the documents this organization uploaded"],
  [/^verification history/, "See earlier verification decisions for this organization"],
  [/^upload \d+ (documents?|files?)/, "Upload the selected files"],
  [/^message .+/, "Send a message to this person"],
]

const TRAILING_COUNT = /\s*\(?\d+\+?\)?$/

// Plain, non-clickable text (badges, role labels) only gets a tooltip for these
// labels, so ordinary sentences and headings never sprout one by accident.
const BADGE_LABELS = new Set([
  "awaiting approval", "awaiting admin approval", "high urgency", "standard",
  "pending verification", "awaiting payment", "published", "rejected",
  "owner", "manager", "viewer", "owner · account holder",
])

export function resolveTooltip(rawLabel: string, area: TooltipArea, interactive = true): string | null {
  const label = rawLabel.replace(/\s+/g, " ").trim().toLowerCase()
  if (!label || label.length > 60) return null
  const key = label.replace(TRAILING_COUNT, "").trim() || label
  if (!interactive && !BADGE_LABELS.has(key)) return null
  if (area !== "site") {
    const scoped = TOOLTIP_LABELS[`${area}:${key}`]
    if (scoped) return scoped
  }
  const general = TOOLTIP_LABELS[key]
  if (general) return general
  for (const [pattern, text] of TOOLTIP_PATTERNS) {
    if (pattern.test(key)) return text
  }
  return null
}
