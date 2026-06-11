/**
 * Navigation memory + deep-link import helpers.
 *
 * ── Why this module exists / Vue → React differences ────────────────
 * In the Vue app this logic lived inline in App.vue and keyed off Vue
 * Router's `route.name`. React Router has no route names — navigation is
 * by PATH. So everything here is path-based: we remember `location.pathname`
 * (+ search) and restore by navigating to that path.
 *
 * The "non-restorable" set is therefore expressed as path prefixes instead
 * of route names. Same intent as the Vue version: transient or
 * cold-unsafe screens shouldn't be auto-restored on reload.
 * ─────────────────────────────────────────────────────────────────────
 */

const NAV_MEMORY_KEY = 'wn:lastRoute'

// Paths that should NEVER be auto-restored on reload — either transient
// (deep-link landing pages, gates) or unsafe to land on cold (e.g.
// order-builder needs an in-progress draft to make sense).
//
// Matched by prefix so '/profile/share' etc. are unaffected; these are
// exact top-level screens.
const NON_RESTORABLE_PATHS = new Set([
  '/onboarding',
  '/bot-required',
  '/import', // deep-link only — fresh code or back to home
  '/order-builder', // needs a draft; cold-restore would show empty cart
])

function isNonRestorable(pathname) {
  return NON_RESTORABLE_PATHS.has(pathname)
}

/**
 * Persist the current location so a reload restores it.
 * `location` is a React Router location ({ pathname, search }).
 */
export function rememberRoute(location) {
  try {
    if (!location?.pathname) return
    if (isNonRestorable(location.pathname)) return
    sessionStorage.setItem(
      NAV_MEMORY_KEY,
      JSON.stringify({
        pathname: location.pathname,
        search: location.search || '',
      }),
    )
  } catch {
    /* storage unavailable — silent no-op */
  }
}

/**
 * Read the remembered location, or null if none / non-restorable.
 * Returns { pathname, search } suitable for navigate(`${pathname}${search}`).
 */
export function readRememberedRoute() {
  try {
    const raw = sessionStorage.getItem(NAV_MEMORY_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.pathname || isNonRestorable(data.pathname)) return null
    return { pathname: data.pathname, search: data.search || '' }
  } catch {
    return null
  }
}

/**
 * Is the current page load a reload (vs a fresh navigation)?
 *
 * Why sessionStorage isn't enough on its own (carried over from the Vue
 * comment): some Telegram WebViews on Android keep sessionStorage alive
 * across full closes, so we cross-check the Performance API's navigation
 * type. Absence of the data → treat as "not a reload" (conservative:
 * default to home rather than surprise the user with a stale screen).
 */
export function isPageReload() {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0]
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

/**
 * Telegram passes a string in initDataUnsafe.start_param when the Mini App
 * is opened via a deep link like `t.me/<bot>?startapp=<value>`. We use this
 * for "import-share" links — `import_<code>` should land the user directly
 * on the import screen with the code prefilled. Other start_params (or none)
 * → returns null and boot routes normally.
 *
 * Read lazily (at boot time) so we always see the freshest value.
 */
export function deepLinkImportCode() {
  const param = window.Telegram?.WebApp?.initDataUnsafe?.start_param
  if (typeof param !== 'string') return null
  if (!param.startsWith('import_')) return null
  const code = param
    .slice('import_'.length)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return code.length >= 4 ? code : null
}