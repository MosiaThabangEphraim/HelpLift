// Shared rules for anonymous tip-offs about registered organizations
// (components/tip-off-dialog.tsx, app/api/tip-offs, the admin Inquiries tab).
// Evidence files follow the developer report rules (lib/developer-report-files.ts)
// but live in their own private bucket (20261008000200_tip_offs.sql).

export const TIP_OFF_BUCKET = "tip-off-evidence"

export const TIP_OFF_CATEGORIES = [
  { value: "fraud", label: "Fraud or misuse of donations" },
  { value: "fake_organization", label: "Fake or misrepresented organization" },
  { value: "scam", label: "Asking people to pay or share login details" },
  { value: "abuse", label: "Abuse, exploitation or harm to people" },
  { value: "corruption", label: "Corruption or bribery" },
  { value: "other", label: "Other illegal or suspicious activity" },
] as const

export type TipOffCategory = (typeof TIP_OFF_CATEGORIES)[number]["value"]

export const TIP_OFF_STATUSES = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "action_taken", label: "Action taken" },
  { value: "unfounded", label: "Unfounded" },
  { value: "closed", label: "Closed" },
] as const

export type TipOffStatus = (typeof TIP_OFF_STATUSES)[number]["value"]

export const tipOffCategoryLabel = (value: string) =>
  TIP_OFF_CATEGORIES.find(category => category.value === value)?.label || "Other"
