"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { toEmbeddableVideoUrl, isDirectVideoFile } from "@/lib/video-embed"

export type GalleryMedia = { id: string; media_type: string; url: string }

// A horizontally scrollable, swipeable gallery for a story's photos/videos —
// scroll-snap does the swipe/drag-to-scroll natively (touch + trackpad +
// mouse-wheel-shift), no carousel library needed. Dots track scroll position
// via onScroll and also let the viewer jump straight to an item. Clicking a
// photo opens it full-size in a lightbox, rendered via a portal to
// document.body — this gallery is sometimes used inside a Radix Dialog,
// whose content wrapper has a CSS transform, and a transform establishes a
// new containing block for `position: fixed` descendants, so a plain fixed
// overlay nested in there would be clipped to the dialog instead of covering
// the viewport.
//
// Portaling to document.body also means this lightbox sits outside the
// Dialog's own DOM subtree, so Radix's dismissable-layer would otherwise
// treat every click/Escape in here as "outside the dialog" and close the
// whole story too. The `data-story-lightbox` marker below lets the parent
// Dialog's onPointerDownOutside (see app/page.tsx) recognize clicks that
// land in here and ignore them — stopping propagation on the portal node
// itself doesn't work here, since it's a DOM sibling of the app's React
// root (not a descendant), so it never reaches Radix's listener via bubbling
// in the first place; Radix's own escape hatch is the reliable fix.
export function StoryMediaGallery({
  media,
  title,
  heightClassName = "h-80",
  onLightboxOpenChange,
}: {
  media: GalleryMedia[]
  title: string
  heightClassName?: string
  /** Fires whenever the full-size lightbox opens/closes — if this gallery
   * lives inside a Dialog, pass this through so the Dialog can ignore its
   * own Escape-key-closes-me handling while the lightbox (portaled outside
   * the Dialog's DOM) is the thing that should close first. */
  onLightboxOpenChange?: (open: boolean) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const images = media.filter((m) => m.media_type !== "video")

  useEffect(() => {
    onLightboxOpenChange?.(lightboxIndex !== null)
  }, [lightboxIndex, onLightboxOpenChange])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null)
      else if (e.key === "ArrowLeft") setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length))
      else if (e.key === "ArrowRight") setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightboxIndex, images.length])

  if (media.length === 0) return null

  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveIndex(Math.max(0, Math.min(media.length - 1, index)))
  }

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl"
        style={{ scrollbarWidth: "thin" }}
      >
        {media.map((item) => (
          <div key={item.id} className="w-full shrink-0 snap-center">
            {item.media_type === "video" ? (
              isDirectVideoFile(item.url) ? (
                <video src={item.url} controls className={`w-full ${heightClassName} object-cover rounded-2xl`} />
              ) : toEmbeddableVideoUrl(item.url) ? (
                <div className={`w-full ${heightClassName} rounded-2xl overflow-hidden`}>
                  <iframe
                    src={toEmbeddableVideoUrl(item.url)!}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <a href={item.url} target="_blank" rel="noreferrer" className={`flex ${heightClassName} items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm font-bold text-blue-600 hover:underline`}>
                  Watch video ↗
                </a>
              )
            ) : (
              <button
                type="button"
                onClick={() => setLightboxIndex(images.findIndex((m) => m.id === item.id))}
                className={`w-full ${heightClassName} block cursor-zoom-in`}
                aria-label="View full-size photo"
              >
                <img src={item.url} alt={title} className={`w-full ${heightClassName} object-cover rounded-2xl`} />
              </button>
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToIndex(index)}
              aria-label={`Show photo/video ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300 dark:bg-slate-700"}`}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && images[lightboxIndex] && typeof document !== "undefined" && createPortal(
        <div
          data-story-lightbox=""
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length)) }}
                className="absolute left-2 md:left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i === null ? i : (i + 1) % images.length)) }}
                className="absolute right-2 md:right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={images[lightboxIndex].url}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
          {images.length > 1 && (
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white">
              {lightboxIndex + 1} / {images.length}
            </span>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
