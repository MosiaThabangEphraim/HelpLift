/* HelpLift service worker: temporary READ-ONLY offline access.
 *
 * What it saves, and for how long
 *   - The app itself (pages and files you've already opened) so it opens offline.
 *   - Public data (needs, organizations, stories...).
 *   - The signed-in person's own dashboard data (their needs, interests,
 *     donations, messages...). This is private: the page wipes it when they sign
 *     out or a different person signs in (see components/offline-provider.tsx).
 *   Everything saved is treated as expired after 24 hours and is then ignored.
 *
 * Strategy: try the network first and use what's saved only when the network
 * fails, so online people always see fresh data. Only GET requests are handled;
 * anything that changes data (sending, saving, paying, uploading) always goes to
 * the network and simply fails offline, and the page explains why.
 */

const VERSION = "v1"
const STATIC_CACHE = `helplift-static-${VERSION}`
const PAGES_CACHE = `helplift-pages-${VERSION}`
const PUBLIC_DATA_CACHE = `helplift-public-data-${VERSION}`
// The "helplift-private-" prefix is what the page deletes on sign-out.
const PRIVATE_CACHE = `helplift-private-${VERSION}`
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE, PUBLIC_DATA_CACHE, PRIVATE_CACHE]

const MAX_AGE_MS = 24 * 60 * 60 * 1000
const STAMP = "x-helplift-cached-at"
const OFFLINE_PAGE = "/offline.html"

// Same-origin API paths that must never be saved (accounts, sign-in, admin, hooks).
const API_NEVER_CACHE = /^\/api\/(login|logout|register|revoke|webhooks|account|admin|password-change|settings|feedback)(\/|$)/

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([OFFLINE_PAGE, "/icon.svg"])).then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("helplift-") && !KNOWN_CACHES.includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// Saves a copy of the response with the time it was saved, so old copies can be ignored.
async function save(cache, request, response) {
  const headers = new Headers(response.headers)
  headers.set(STAMP, String(Date.now()))
  const body = await response.clone().blob()
  await cache.put(request, new Response(body, { status: response.status, statusText: response.statusText, headers }))
}

// A saved copy, only if it's less than 24 hours old.
async function saved(cache, request) {
  const cached = await cache.match(request)
  if (!cached) return undefined
  const savedAt = Number(cached.headers.get(STAMP) || 0)
  if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) {
    await cache.delete(request)
    return undefined
  }
  return cached
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok && response.status === 200 && !response.redirected) {
      await save(cache, request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await saved(cache, request)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

// Page loads: network first; offline, an earlier copy of that page, else the offline page.
async function navigate(request) {
  const cache = await caches.open(PAGES_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok && response.status === 200 && response.type === "basic" && !response.redirected) {
      await save(cache, request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await saved(cache, request)
    if (cached) return cached
    const fallback = await caches.match(OFFLINE_PAGE)
    return fallback || Response.error()
  }
}

self.addEventListener("fetch", event => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  if (request.mode === "navigate") {
    event.respondWith(navigate(request))
    return
  }

  if (sameOrigin) {
    // Hashed build files never change, so keep them (and app icons/images) for offline start-up.
    if (url.pathname.startsWith("/_next/static/") || /\.(png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
      event.respondWith(cacheFirst(request))
      return
    }
    // Page data fetched while moving between pages.
    if (url.searchParams.has("_rsc")) {
      event.respondWith(networkFirst(request, PAGES_CACHE))
      return
    }
    if (url.pathname.startsWith("/api/") && !API_NEVER_CACHE.test(url.pathname)) {
      event.respondWith(networkFirst(request, url.pathname.startsWith("/api/public/") ? PUBLIC_DATA_CACHE : PRIVATE_CACHE))
      return
    }
    return
  }

  // Supabase: the dashboards read their own records straight from the database, and check who is
  // signed in with /auth/v1/user. Both are private to the signed-in person.
  if (url.hostname.endsWith(".supabase.co") && (url.pathname.startsWith("/rest/v1/") || url.pathname === "/auth/v1/user")) {
    event.respondWith(networkFirst(request, PRIVATE_CACHE))
  }
})
