// Single source of truth for need categories, shared between the organization
// need-creation form (organisation-dashboard) and the public needs board search
// filters (needs page). Previously the create-need field was free text while the
// public board filtered against this fixed list, so category filtering silently
// never matched most real needs. Keeping both in sync here avoids drift.
export const NEED_CATEGORIES = [
  "Education",
  "Food & Nutrition",
  "Medical & Healthcare",
  "Shelter & Housing",
  "Clothing",
  "Youth & Community",
] as const
