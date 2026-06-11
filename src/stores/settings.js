import { create } from 'zustand'
import { getColorScheme, isInsideTelegram, setHeaderColor } from '@/utils/telegram'
import { meApi } from '@/api/me'

/**
 * Appearance settings: accent color + theme mode.
 *
 * Persistence is dual-track on purpose:
 *   1) Server (PATCH /me) — the canonical store, syncs across devices.
 *      User flips theme on phone → opens desktop next day → same theme.
 *   2) localStorage — fast local cache. Reads paint the UI before /me
 *      arrives, so the user never sees a light-mode flash on a dark
 *      device. Writes happen on every change so an offline tweak survives
 *      a reload even if we can't reach the server.
 *
 * Conflict resolution: when both have a value, the server wins on app
 * start (it's the "source of truth across devices"). Within a session,
 * the user's most recent choice wins both locally and server-side.
 *
 * Theme "auto" follows Telegram's colorScheme (or the OS prefers-color-scheme
 * when running outside Telegram) and reacts live to changes.
 *
 * ── Porting notes (Pinia → Zustand) ─────────────────────────────────
 * 1. `accent` was a computed. In Zustand we expose it as a getter fn
 *    accentObj() that derives from accentKey. Components that want it
 *    reactively can use the inline selector shown at the bottom, OR just
 *    select accentKey and look it up via the exported ACCENTS array.
 * 2. `resolvedTheme` was a computed too → getter fn resolvedTheme().
 * 3. The module-level `inflight`/`pending`/`bound` vars in the Vue setup
 *    store stay module-level here as well (they're singletons tied to the
 *    one store instance — same lifetime as before). No need to put them
 *    in React state; they're plumbing, not UI.
 * 4. DOM side-effects (setProperty, setAttribute, setHeaderColor) are
 *    identical — they touch document.documentElement, which is
 *    framework-independent. This is the same approach the Vue store used.
 * ─────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY = 'wn:appearance'

// Five pastel accents. `green` is the app's original accent — keeping it first
// and as the default means the UI looks identical until the user picks another.
export const ACCENTS = [
  { key: 'green',    label: 'Зелёный', accent: '#4caf50', soft: '#a8d5b4', bg: '#e8f5ec', ink: '#2e7d32' },
  { key: 'lavender', label: 'Лаванда', accent: '#8e6fc7', soft: '#c9beda', bg: '#f0ecf6', ink: '#6a4190' },
  { key: 'sky',      label: 'Небо',    accent: '#4a90d9', soft: '#b6d4ec', bg: '#e6f0fa', ink: '#1565c0' },
  { key: 'peach',    label: 'Персик',  accent: '#e8884a', soft: '#f4c4a3', bg: '#fff0e6', ink: '#c25e1a' },
  { key: 'rose',     label: 'Роза',    accent: '#e26d8a', soft: '#f5b8b8', bg: '#fde8e8', ink: '#c62828' },
]

export const THEME_OPTIONS = [
  { key: 'auto',  label: 'Авто' },
  { key: 'light', label: 'Светлая' },
  { key: 'dark',  label: 'Тёмная' },
]

const THEME_KEYS = THEME_OPTIONS.map((t) => t.key)
const PAGE_BG = { light: '#f5f5f7', dark: '#131318' }

// Module-level plumbing — singletons, not UI state (see porting note 3).
let inflight = null
let pending = null
let bound = false

/** The system's current scheme — Telegram first, OS as fallback. */
function systemScheme() {
  if (isInsideTelegram()) return getColorScheme() === 'dark' ? 'dark' : 'light'
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const useSettingsStore = create((set, get) => ({
  accentKey: 'green',
  theme: 'auto', // 'auto' | 'light' | 'dark'

  // === getters (were: computed) ===

  /** The full accent object for the current accentKey. */
  accentObj: () =>
    ACCENTS.find((a) => a.key === get().accentKey) || ACCENTS[0],

  /** Effective theme actually painted ('auto' resolved to light/dark). */
  resolvedTheme: () =>
    get().theme === 'auto' ? systemScheme() : get().theme,

  // === DOM application (side-effects, framework-independent) ===

  applyAccent: () => {
    const a = get().accentObj()
    const r = document.documentElement
    r.style.setProperty('--wn-accent', a.accent)
    r.style.setProperty('--wn-accent-soft', a.soft)
    r.style.setProperty('--wn-accent-bg', a.bg)
    r.style.setProperty('--wn-accent-ink', a.ink)
  },

  applyTheme: () => {
    const eff = get().resolvedTheme()
    document.documentElement.setAttribute('data-theme', eff)
    // Keep the Telegram native header in sync with the page background.
    try {
      setHeaderColor(PAGE_BG[eff])
    } catch {
      /* outside Telegram */
    }
  },

  // === setters ===

  setAccent: (key) => {
    if (!ACCENTS.some((a) => a.key === key)) return
    if (get().accentKey === key) return
    set({ accentKey: key })
    get().applyAccent()
    get().persistLocal()
    // Fire-and-forget server sync. Don't await — UI shouldn't wait for
    // the network. On failure we keep the local change; next successful
    // PATCH will catch up.
    get().syncToServer({ accent_key: key })
  },

  setTheme: (value) => {
    if (!THEME_KEYS.includes(value)) return
    if (get().theme === value) return
    set({ theme: value })
    get().applyTheme()
    get().persistLocal()
    get().syncToServer({ theme: value })
  },

  // === local persistence ===

  persistLocal: () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accentKey: get().accentKey, theme: get().theme }),
      )
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  },

  loadLocal: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      const patch = {}
      if (data.accentKey && ACCENTS.some((a) => a.key === data.accentKey)) {
        patch.accentKey = data.accentKey
      }
      if (THEME_KEYS.includes(data.theme)) patch.theme = data.theme
      if (Object.keys(patch).length) set(patch)
    } catch {
      /* corrupt value — fall back to defaults */
    }
  },

  /**
   * Apply preferences received from the server (typically /me on boot).
   * The server is the canonical source on app start — it wins over
   * whatever localStorage had cached. We still update localStorage to
   * keep the next cold start fast.
   */
  applyFromUser: (user) => {
    if (!user) return
    const patch = {}
    if (user.accent_key && ACCENTS.some((a) => a.key === user.accent_key)) {
      if (get().accentKey !== user.accent_key) patch.accentKey = user.accent_key
    }
    if (THEME_KEYS.includes(user.theme)) {
      if (get().theme !== user.theme) patch.theme = user.theme
    }
    if (Object.keys(patch).length) {
      set(patch)
      get().applyAccent()
      get().applyTheme()
      get().persistLocal()
    }
  },

  /**
   * Push a change to the server. Best-effort: errors are logged but
   * don't surface to the user — appearance is too low-stakes to bother
   * with a retry UI, and the next successful change will overwrite
   * whatever drift accumulated.
   *
   * Inflight tracking ensures rapid toggles (e.g. user mashing the
   * accent swatches) don't pile up overlapping PATCH calls — we keep
   * only the latest pending value and dispatch it once the current
   * one settles.
   */
  syncToServer: async (patch) => {
    pending = { ...(pending || {}), ...patch }
    if (inflight) return
    while (pending) {
      const next = pending
      pending = null
      inflight = meApi.update(next).catch((e) => {
        // Soft-fail: keep local state, log for diagnostics.
        console.warn('[settings] failed to sync to /me', e?.message || e)
      })
      try {
        await inflight
      } finally {
        inflight = null
      }
    }
  },

  /**
   * Paint the saved prefs to the DOM and start listening for system
   * theme changes. Safe to call before `/me` has loaded — pass user
   * later via `applyFromUser` once it's available.
   */
  init: () => {
    get().loadLocal()
    get().applyAccent()
    get().applyTheme()
    if (bound) return
    bound = true

    const onSystemChange = () => {
      if (get().theme === 'auto') get().applyTheme()
    }

    // Telegram theme switches (user flips Telegram light/dark)
    const tgApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
    if (tgApp?.onEvent) tgApp.onEvent('themeChanged', onSystemChange)

    // OS scheme changes (when running outside Telegram / desktop)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.addEventListener) mq.addEventListener('change', onSystemChange)
      else if (mq.addListener) mq.addListener(onSystemChange)
    }
  },
}))

// ── Reactive accent selector (optional convenience for components) ──────
// Equivalent of Vue's `settings.accent` computed. Use in a component as:
//   const accent = useSettingsStore(selectAccent)
// It re-renders only when accentKey changes.
export const selectAccent = (s) =>
  ACCENTS.find((a) => a.key === s.accentKey) || ACCENTS[0]