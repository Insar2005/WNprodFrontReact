/**
 * Telegram WebApp wrapper. Centralises all Telegram.WebApp access
 * so the rest of the app doesn't deal with `window.Telegram` directly.
 *
 * Plain JS — no framework dependencies (React or otherwise). React
 * bindings for hooks live in @/hooks/useTelegramBackButton.
 *
 * ── Fullscreen mode (Bot API 8.0+, July 2026 migration) ─────────────
 * We opt into fullscreen at boot via requestFullscreen(). In fullscreen
 * the Telegram header (with the "Waiter Note" title and ⋯ menu) sits
 * as a translucent OVERLAY on top of our content — meaning our page
 * headers would collide with it unless we push them down by the height
 * of the "content safe area".
 *
 * Two insets matter:
 *   • safeAreaInset — the DEVICE's safe area (iOS notch, status bar,
 *     home indicator on modern iPhones)
 *   • contentSafeAreaInset — the TELEGRAM CLIENT's overlay (the header
 *     bar in fullscreen). Zero in windowed/fullsize mode.
 *
 * We publish BOTH as CSS custom properties on <html>:
 *   --wn-safe-top    = max(safeAreaInset.top, contentSafeAreaInset.top)
 *   --wn-safe-bottom = safeAreaInset.bottom + contentSafeAreaInset.bottom
 *   --wn-safe-left / --wn-safe-right analogous
 *
 * Consumers use these instead of raw `env(safe-area-inset-*)` because
 * env() doesn't know about the Telegram overlay. The values update in
 * real time via the safeAreaChanged / contentSafeAreaChanged events —
 * e.g. rotating the device or expanding a menu.
 * ─────────────────────────────────────────────────────────────────────
 */

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

/**
 * Get initData string to send to backend in X-Init-Data header.
 * In dev (not running in Telegram), reads VITE_DEV_INIT_DATA from env.
 */
export function getInitData() {
  if (tg?.initData) return tg.initData
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

/** Expand to full available height. Call early to avoid jumpy UI. */
export function expand() {
  tg?.expand()
}

/**
 * Request Telegram to enter fullscreen mode (Bot API 8.0+).
 * Silent no-op on older clients. In fullscreen the Telegram header
 * becomes a translucent overlay — see file header note.
 */
export function requestFullscreen() {
  if (typeof tg?.requestFullscreen === 'function') {
    try {
      tg.requestFullscreen()
    } catch {
      // Older clients may throw on unknown method — safe to ignore.
    }
  }
}

/** Leave fullscreen (Bot API 8.0+). No-op on older clients. */
export function exitFullscreen() {
  if (typeof tg?.exitFullscreen === 'function') {
    try {
      tg.exitFullscreen()
    } catch {
      // ignore
    }
  }
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

// ────────────────────────────────────────────────────────────────────
// BackButton
// ────────────────────────────────────────────────────────────────────

/**
 * Show Telegram's native back button (top-left corner in the client
 * header) and register a callback for taps. Returns a cleanup function
 * that hides the button and removes the listener.
 *
 * Idiomatic use is via useTelegramBackButton (React hook) — this raw
 * API exists so non-React code (or tests) can drive it too.
 *
 * Only one callback should be active at a time. If a screen calls this
 * and another screen calls it later, Telegram fires the second
 * callback. The hook takes care of ordering.
 */
export function showBackButton(onClick) {
  const bb = tg?.BackButton
  if (!bb) {
    // Not in Telegram (or the client is too old to have BackButton).
    // Return a no-op cleanup so callers don't have to null-check.
    return () => {}
  }
  bb.onClick(onClick)
  bb.show()
  return () => {
    try {
      bb.offClick(onClick)
      bb.hide()
    } catch {
      // Ignore — the button may already be gone.
    }
  }
}

/** Hide the back button unconditionally. */
export function hideBackButton() {
  try {
    tg?.BackButton?.hide()
  } catch {
    // ignore
  }
}

// ────────────────────────────────────────────────────────────────────
// Safe area + fullscreen tracking
// ────────────────────────────────────────────────────────────────────

/**
 * Read the four device safe-area insets. Falls back to 0/0/0/0 when the
 * client doesn't expose them (older Telegram builds).
 */
function readSafeAreaInset() {
  const sa = tg?.safeAreaInset
  return {
    top: sa?.top ?? 0,
    bottom: sa?.bottom ?? 0,
    left: sa?.left ?? 0,
    right: sa?.right ?? 0,
  }
}

/**
 * Read the content safe-area insets — the space taken up by Telegram's
 * own overlay chrome (header in fullscreen mode). Zero in windowed
 * modes and on clients without fullscreen support.
 */
function readContentSafeAreaInset() {
  const csa = tg?.contentSafeAreaInset
  return {
    top: csa?.top ?? 0,
    bottom: csa?.bottom ?? 0,
    left: csa?.left ?? 0,
    right: csa?.right ?? 0,
  }
}

/**
 * Publish the effective insets as CSS custom properties on <html>.
 *
 * Top/left/right: take the MAX of device and content insets — either
 * can obscure content, but they don't stack (both come from the top of
 * the screen). Bottom: SUM them — device home indicator and any
 * Telegram bottom chrome are at the same edge but can co-exist.
 *
 * All values in px (Telegram's insets are already in px).
 */
function publishInsets() {
  if (typeof document === 'undefined') return
  const sa = readSafeAreaInset()
  const csa = readContentSafeAreaInset()
  const top = Math.max(sa.top, csa.top)
  const bottom = sa.bottom + csa.bottom
  const left = Math.max(sa.left, csa.left)
  const right = Math.max(sa.right, csa.right)
  const root = document.documentElement.style
  root.setProperty('--wn-safe-top', `${top}px`)
  root.setProperty('--wn-safe-bottom', `${bottom}px`)
  root.setProperty('--wn-safe-left', `${left}px`)
  root.setProperty('--wn-safe-right', `${right}px`)
}

/** Whether Telegram is currently in fullscreen mode. */
export function isFullscreen() {
  return !!tg?.isFullscreen
}

/**
 * Subscribe to Telegram events that can change our insets. Returns an
 * unsubscribe function. Called once from initTelegram() so the CSS
 * variables stay fresh throughout the app's lifetime.
 */
function subscribeToInsetEvents() {
  if (!tg?.onEvent) return () => {}
  const events = [
    'safeAreaChanged',
    'contentSafeAreaChanged',
    'fullscreenChanged',
    'viewportChanged',
  ]
  const handler = () => publishInsets()
  for (const e of events) {
    try {
      tg.onEvent(e, handler)
    } catch {
      // older clients may not know some events — ignore
    }
  }
  return () => {
    for (const e of events) {
      try {
        tg.offEvent(e, handler)
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Initialize Telegram WebApp UI. Call once on app startup.
 *
 * Order matters:
 *   1. ready()               — tell Telegram we're painted; hides splash
 *   2. expand()              — full available height (windowed users)
 *   3. requestFullscreen()   — go fullscreen if the client supports it
 *   4. disableVerticalSwipes() — prevent accidental app-close swipes
 *   5. publishInsets()       — write CSS vars for immediate use
 *   6. subscribeToInsetEvents() — keep those CSS vars fresh
 */
export function initTelegram() {
  if (!tg) {
    // Not running inside Telegram — still publish "no insets" so CSS
    // rules that reference the vars fall back cleanly.
    publishInsets()
    return
  }
  ready()
  expand()
  requestFullscreen()
  disableVerticalSwipes()
  publishInsets()
  subscribeToInsetEvents()
}