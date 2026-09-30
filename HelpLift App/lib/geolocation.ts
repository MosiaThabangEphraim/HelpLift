// "Needs near me" - the browser's own Geolocation API for a live position,
// then a free Nominatim (OpenStreetMap) lookup, no API key, no cost.
// reverseGeocodePlaceNames() turns the giver's position into human-readable
// place names for display ("Showing needs near Emfuleni, Sedibeng").
// Actual matching, though, uses real coordinates: a need's location text is
// forward-geocoded server-side when it's created/edited (see
// api/organization/needs) and stored on the row, then haversineKm() compares
// that against the giver's live position - real distance, not place-name
// text matching, which misses cases like "Vaal" being well within range of
// "Emfuleni Local Municipality" despite sharing no words with it.

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available on this device/browser."))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const message =
        err.code === err.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser's site settings to use this."
          : "Could not get your current location."
      reject(new Error(message))
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 })
  })
}

// Returns place names (suburb, city/town, province) most-specific first -
// for display only ("Showing needs near ...").
export async function reverseGeocodePlaceNames(lat: number, lng: number): Promise<string[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
    { headers: { Accept: "application/json" } }
  )
  if (!res.ok) throw new Error("Could not determine your area from your location.")
  const data = await res.json()
  const address = data?.address || {}
  const candidates = [address.suburb, address.city || address.town || address.village, address.county, address.state]
  return candidates.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

// Forward-geocodes free text ("Vaal", or an organization's city/province)
// to coordinates. South Africa-scoped (countrycodes=za), since that's the
// only country this platform operates in and it avoids mismatches with
// same-named places elsewhere. Best-effort: returns null rather than
// throwing, since callers use this to opportunistically set a need's
// coordinates and must never let a geocoding hiccup block creating/editing
// the need itself.
export async function forwardGeocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&countrycodes=za&limit=1`,
      { headers: { Accept: "application/json", "User-Agent": "HelpLift (https://helplift.app)" } }
    )
    if (!res.ok) return null
    const results = await res.json()
    const first = Array.isArray(results) ? results[0] : null
    const lat = Number(first?.lat)
    const lng = Number(first?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

// Great-circle distance between two coordinates, in kilometers.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// How far counts as "near me". South African towns are spread out, so this
// is generous on purpose - tight enough to be meaningful, loose enough not
// to exclude a giver's own general region.
export const NEAR_ME_RADIUS_KM = 50
