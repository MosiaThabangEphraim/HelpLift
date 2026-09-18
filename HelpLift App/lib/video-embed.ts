// Turns a YouTube/Vimeo watch link into its embeddable iframe URL. Falls back
// to null for anything else (a direct video file gets played via a plain
// <video> tag instead, handled by the caller).
export function toEmbeddableVideoUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, "")

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v")
      if (id) return `https://www.youtube.com/embed/${id}`
      const shorts = parsed.pathname.match(/^\/shorts\/([^/]+)/)
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`
      return null
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1)
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0]
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    return null
  } catch {
    return null
  }
}

export function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)($|\?)/i.test(url)
}
