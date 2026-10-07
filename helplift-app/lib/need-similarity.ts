// Text similarity used to warn organizations about needs that look like one
// they are about to post (spec 4.4, duplicate prevention). No database
// extension is needed: needs are compared by their shared meaningful words.

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it", "its", "of", "on",
  "or", "our", "that", "the", "their", "them", "these", "this", "to", "we", "will", "with", "who", "need", "needs",
  "needed", "help", "support", "please", "urgently", "request", "requests", "looking", "require", "required",
])

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y"
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1)
  return word
}

export function tokenize(text: string | null | undefined): Set<string> {
  const words = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .map(stem)
  return new Set(words)
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  a.forEach(word => { if (b.has(word)) shared++ })
  // Share of the smaller text that also appears in the other, so a short title
  // matching part of a longer one still counts.
  return shared / Math.min(a.size, b.size)
}

export type SimilarityInput = { title?: string | null; description?: string | null; category?: string | null; location?: string | null }

// Returns a 0-1 score. Titles carry most of the weight; the same category and
// location nudge it up.
export function needSimilarity(draft: SimilarityInput, existing: SimilarityInput): number {
  const titleScore = overlap(tokenize(draft.title), tokenize(existing.title))
  const bodyScore = overlap(
    tokenize(`${draft.title || ""} ${draft.description || ""}`),
    tokenize(`${existing.title || ""} ${existing.description || ""}`),
  )
  let score = titleScore * 0.65 + bodyScore * 0.35
  if (draft.category && existing.category && draft.category === existing.category) score += 0.05
  const a = (draft.location || "").trim().toLowerCase()
  const b = (existing.location || "").trim().toLowerCase()
  if (a && b && (a.includes(b) || b.includes(a))) score += 0.05
  return Math.min(1, score)
}

export const SIMILARITY_THRESHOLD = 0.55
