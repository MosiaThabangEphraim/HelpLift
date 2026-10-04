"use client"

import { useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { Map as LeafletMap } from "leaflet"
import "leaflet/dist/leaflet.css"

// Open needs plotted on an OpenStreetMap map (free tiles, no API key - same
// provider as the Nominatim geocoding in lib/geolocation.ts). Coordinates come
// from the forward-geocoded needs.latitude/longitude; needs without them are
// left off the map and counted below it instead.
//
// Clicking a pin opens that need on /needs (?need=<id> opens its detail
// dialog). Needs geocoded to the same spot share one pin, which opens a short
// list to pick from instead.

export type MapNeed = {
  id: string
  title: string
  category?: string | null
  urgency?: string | null
  location?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  organizations?: { name?: string | null } | { name?: string | null }[] | null
}

type PinGroup = { lat: number; lng: number; needs: MapNeed[] }

const SOUTH_AFRICA_CENTER: [number, number] = [-28.5, 24.7]
const URGENCY_COLORS: Record<string, string> = { high: "#dc2626", medium: "#f59e0b", low: "#2563eb" }
const URGENCY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

function urgencyOf(need: MapNeed) {
  return need.urgency && URGENCY_COLORS[need.urgency] ? need.urgency : "medium"
}

function orgName(need: MapNeed) {
  const org = Array.isArray(need.organizations) ? need.organizations[0] : need.organizations
  return org?.name || "Verified organization"
}

function coordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// Tooltip/popup content is built as DOM nodes with textContent - need titles
// are user-entered, so they must never be inserted as HTML.
function textElement(tag: string, text: string, className?: string) {
  const element = document.createElement(tag)
  element.textContent = text
  if (className) element.className = className
  return element
}

export function NeedsMap({ needs }: { needs: MapNeed[] }) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const containerRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const byPosition = new Map<string, PinGroup>()
    for (const need of needs) {
      const lat = coordinate(need.latitude)
      const lng = coordinate(need.longitude)
      if (lat === null || lng === null) continue
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
      const group = byPosition.get(key) ?? { lat, lng, needs: [] }
      group.needs.push(need)
      byPosition.set(key, group)
    }
    return Array.from(byPosition.values())
  }, [needs])

  const pinnedCount = groups.reduce((sum, group) => sum + group.needs.length, 0)
  const unpinnedCount = needs.length - pinnedCount

  useEffect(() => {
    let map: LeafletMap | null = null
    let cancelled = false

    // Leaflet touches `window` on import, so it's loaded only in the browser.
    import("leaflet").then(module => {
      const L = (module as any).default ?? module
      if (cancelled || !containerRef.current) return

      map = L.map(containerRef.current, {
        center: SOUTH_AFRICA_CENTER,
        zoom: 5,
        scrollWheelZoom: false, // don't hijack page scrolling
        dragging: !L.Browser.mobile, // one-finger swipes keep scrolling the page on phones
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        className: "helplift-map-tiles",
      }).addTo(map)

      const openNeed = (id: string) => routerRef.current.push(`/needs?need=${encodeURIComponent(id)}`)

      for (const group of groups) {
        const top = group.needs.reduce((best, need) => (URGENCY_RANK[urgencyOf(need)] > URGENCY_RANK[urgencyOf(best)] ? need : best))
        const color = URGENCY_COLORS[urgencyOf(top)]
        const single = group.needs.length === 1

        const marker = L.circleMarker([group.lat, group.lng], {
          radius: single ? 8 : Math.min(8 + group.needs.length * 1.5, 16),
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        }).addTo(map)

        const tooltip = document.createElement("div")
        if (single) {
          tooltip.append(textElement("strong", group.needs[0].title), document.createElement("br"), textElement("span", orgName(group.needs[0])))
        } else {
          tooltip.append(textElement("strong", `${group.needs.length} needs here`), document.createElement("br"), textElement("span", "Click to choose one"))
        }
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -6] })

        if (single) {
          marker.on("click", () => openNeed(group.needs[0].id))
        } else {
          const list = document.createElement("div")
          list.className = "helplift-map-popup"
          for (const need of group.needs) {
            const button = textElement("button", need.title)
            button.setAttribute("type", "button")
            button.title = `${need.title} - ${orgName(need)}`
            button.addEventListener("click", () => openNeed(need.id))
            list.append(button)
          }
          marker.bindPopup(list, { maxWidth: 260 })
        }
      }

      if (groups.length > 0) {
        map!.fitBounds(L.latLngBounds(groups.map(group => [group.lat, group.lng])), { padding: [40, 40], maxZoom: 8 })
      }
    })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [groups])

  return (
    <div className="flex flex-col gap-3">
      {/* `isolate` keeps Leaflet's high z-index panes and controls below the fixed navbar and chat widget. */}
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of open community needs"
        className="isolate h-[380px] md:h-[440px] w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 overflow-hidden"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-4">
          {(["high", "medium", "low"] as const).map(level => (
            <span key={level} className="inline-flex items-center gap-1.5 capitalize">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: URGENCY_COLORS[level] }} />
              {level} urgency
            </span>
          ))}
        </div>
        <p>
          {pinnedCount} need{pinnedCount === 1 ? "" : "s"} on the map
          {unpinnedCount > 0 && (
            <>
              {" · "}
              <Link href="/needs" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                {unpinnedCount} more without a map location
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
