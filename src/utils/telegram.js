/**
 * Telegram WebApp wrapper. Centralises all Telegram.WebApp access
 * so the rest of the app doesn't deal with `window.Telegram` directly.
 *
 * NOTE: This file is framework-agnostic (plain JS) and was carried over
 * verbatim from the Vue project — nothing here depends on Vue or React.
 */

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

/**
 * Get initData string to send to backend in X-Init-Data header.
 * In dev (not running in Telegram), reads VITE_DEV_INIT_DATA from env.
 */
export function getInitData() {
  if (tg?.initData) return tg.initData

  // Dev fallback — set VITE_DEV_INIT_DATA in .env for local testing
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_DEV_INIT_DATA || ''
  }
  return ''
}

/** Get parsed user info (or null if outside Telegram). */
export function getUser() {
  return tg?.initDataUnsafe?.user || null
}

/** Get color scheme: 'light' | 'dark'. */
export function getColorScheme() {
  return tg?.colorScheme || 'light'
}

/** Get theme params (bg_color, text_color, etc). */
export function getThemeParams() {
  return tg?.themeParams || {}
}

/** Tell Telegram the app is ready (hides loading spinner). */
export function ready() {
  tg?.ready()
}

/** Expand to full height. Call early to avoid jumpy UI. */
export function expand() {
  tg?.expand()
}

/** Disable vertical swipes that can close the app accidentally. */
export function disableVerticalSwipes() {
  if (typeof tg?.disableVerticalSwipes === 'function') {
    tg.disableVerticalSwipes()
  }
}

/** Show native alert. Falls back to window.alert outside Telegram. */
export function showAlert(message) {
  if (tg?.showAlert) {
    return new Promise((resolve) => tg.showAlert(message, resolve))
  }
  window.alert(message)
  return Promise.resolve()
}

/** Show native confirm. Returns Promise<boolean>. */
export function showConfirm(message) {
  if (tg?.showConfirm) {
    return new Promise((resolve) => tg.showConfirm(message, resolve))
  }
  return Promise.resolve(window.confirm(message))
}

/** Haptic feedback. type: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'. */
export function hapticImpact(type = 'light') {
  tg?.HapticFeedback?.impactOccurred(type)
}

/** Haptic for success/error/warning notifications. */
export function hapticNotification(type = 'success') {
  tg?.HapticFeedback?.notificationOccurred(type)
}

/** Set header color to match app theme. */
export function setHeaderColor(color) {
  if (typeof tg?.setHeaderColor === 'function') {
    tg.setHeaderColor(color)
  }
}

/** Whether we're running inside Telegram. */
export function isInsideTelegram() {
  return !!tg?.initData
}

/** Initialize Telegram WebApp UI. Call once on app startup. */
export function initTelegram() {
  if (!tg) return
  ready()
  expand()
  disableVerticalSwipes()
}
