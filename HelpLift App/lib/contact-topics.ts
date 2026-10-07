// Topics for the homepage contact form (app/page.tsx) - shared with
// app/api/contact so the form and the server always agree. "other" asks the
// sender to type their own topic.

export const CONTACT_TOPICS = [
  { id: "partnership", label: "Partnering or registering an organization" },
  { id: "account", label: "Help with my account" },
  { id: "donations", label: "Donations and payments" },
  { id: "needs", label: "Needs, pledges or the Gift Library" },
  { id: "scam", label: "Report a scam or safety concern" },
  { id: "technical", label: "Technical problem" },
  { id: "feedback", label: "Feedback or suggestion" },
  { id: "media", label: "Media or press" },
  { id: "other", label: "Other" },
] as const

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"]

export const CONTACT_OTHER_TOPIC_MAX = 80

/** The topic as a readable label, or null if it isn't valid. */
export function contactTopicLabel(id: unknown, otherText: unknown): string | null {
  const topic = CONTACT_TOPICS.find(entry => entry.id === id)
  if (!topic) return null
  if (topic.id !== "other") return topic.label
  const custom = typeof otherText === "string" ? otherText.trim().slice(0, CONTACT_OTHER_TOPIC_MAX) : ""
  return custom ? `Other: ${custom}` : null
}
