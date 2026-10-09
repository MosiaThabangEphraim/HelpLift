// Organization timelines (20261009000100_organization_timeline.sql): posts an
// organization shares on its public profile - updates, events, milestones and
// news - with images and documents attached. No admin approval.
//
// Who can do what:
//   coordinator and up - post, and edit or delete their own posts
//   manager and up     - edit, delete or pin any of the organization's posts
//   administrators     - delete any post (moderation)

export const TIMELINE_BUCKET = "org-timeline"

export const TIMELINE_POST_TYPES = [
  { value: "update", label: "Update" },
  { value: "event", label: "Event" },
  { value: "milestone", label: "Milestone" },
  { value: "news", label: "News" },
] as const

export type TimelinePostType = (typeof TIMELINE_POST_TYPES)[number]["value"]

export type TimelineAttachment = { path: string; name: string; type: string; size: number; url: string }

export type TimelinePost = {
  id: string
  organization_id: string
  author_id: string | null
  author_name: string | null
  post_type: TimelinePostType
  title: string | null
  body: string
  event_starts_at: string | null
  event_location: string | null
  attachments: TimelineAttachment[]
  pinned: boolean
  created_at: string
  edited_at: string | null
}

/** What the person looking at a timeline may do with it. */
export type TimelineViewer = {
  userId: string | null
  canPost: boolean
  canManageAll: boolean
  isAdmin: boolean
}

export const TIMELINE_COLUMNS = "id, organization_id, author_id, author_name, post_type, title, body, event_starts_at, event_location, attachments, pinned, created_at, edited_at"

export const timelinePostTypeLabel = (value: string) =>
  TIMELINE_POST_TYPES.find(type => type.value === value)?.label || "Update"

export const isTimelinePostType = (value: unknown): value is TimelinePostType =>
  TIMELINE_POST_TYPES.some(type => type.value === value)

export const isImageAttachment = (attachment: { type?: string; name?: string }) =>
  (attachment.type || "").startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(attachment.name || "")

/** Adds each attachment's public URL (the bucket is public). */
export function withAttachmentUrls(post: any, publicUrl: (path: string) => string): TimelinePost {
  const files = Array.isArray(post.attachments) ? post.attachments : []
  return { ...post, attachments: files.map((file: any) => ({ ...file, url: publicUrl(file.path) })) }
}
