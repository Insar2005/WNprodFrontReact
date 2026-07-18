/**
 * Telegram WebApp wrapper — все обращения к window.Telegram живут тут.
 *
 * Fullscreen (Bot API 8.0+): в fullscreen шапка Telegram становится
 * полупрозрачным overlay поверх нашего контента. Два инсета важны:
 *   • safeAreaInset — устройство (iOS notch, статус-бар, home indicator)
 *   • contentSafeAreaInset — сам Telegram overlay (в windowed = 0)
 *
 * Публикуем оба в CSS custom properties на <html>:
 *   --wn-safe-top    = max(safeAreaInset.top, contentSafeAreaInset.top)
 *   --wn-safe-bottom = safeAreaInset.bottom + contentSafeAreaInset.bottom
 *   --wn-safe-left/right — max
 *
 * Плюс data-tg-fullscreen='true'/'false' атрибут для CSS-гейтов.
 */

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

export function getInitData() {
  if (tg?.initData) return tg.initData
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_DEV_INIT_DATA || ''
  }
  return ''
}

export function getUser() {
  return tg?.initDataUnsafe?.user || null
}

export function getColorScheme() {
  return tg?.colorScheme || 'light'
}

export function getThemeParams() {
  return tg?.themeParams || {}
}

export function ready() {
  tg?.ready()
}

export function expand() {
  tg?.expand()
}

export function requestFullscreen() {
  if (typeof tg?.requestFullscreen === 'function') {
    try {
      tg.requestFullscreen()
    } catch {
      // older clients ignore
    }
  }
}

export function exitFullscreen() {
  if (typeof tg?.exitFullscreen === 'function') {
    try {
      tg.exitFullscreen()
    } catch {
      // ignore
    }
  }
}

export function disableVerticalSwipes() {
  if (typeof tg?.disableVerticalSwipes === 'function') {
    tg.disableVerticalSwipes()
  }
}

export function showAlert(message) {
  if (tg?.showAlert) {
    return new Promise((resolve) => tg.showAlert(message, resolve))
  }
  window.alert(message)
  return Promise.resolve()
}

export function showConfirm(message) {
  if (tg?.showConfirm) {
    return new Promise((resolve) => tg.showConfirm(message, resolve))
  }
  return Promise.resolve(window.confirm(message))
}

export function hapticImpact(type = 'light') {
  tg?.HapticFeedback?.impactOccurred(type)
}

export function hapticNotification(type = 'success') {
  tg?.HapticFeedback?.notificationOccurred(type)
}

export function setHeaderColor(color) {
  if (typeof tg?.setHeaderColor === 'function') {
    tg.setHeaderColor(color)
  }
}

export function isInsideTelegram() {
  return !!tg?.initData
}

// ────────────────────────────────────────────────────────────────────
// BackButton
// ────────────────────────────────────────────────────────────────────

export function showBackButton(onClick) {
  const bb = tg?.BackButton
  if (!bb) return () => {}
  bb.onClick(onClick)
  bb.show()
  return () => {
    try {
      bb.offClick(onClick)
      bb.hide()
    } catch {
      // ignore
    }
  }
}

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

function readSafeAreaInset() {
  const sa = tg?.safeAreaInset
  return {
    top: sa?.top ?? 0,
    bottom: sa?.bottom ?? 0,
    left: sa?.left ?? 0,
    right: sa?.right ?? 0,
  }
}

function readContentSafeAreaInset() {
  const csa = tg?.contentSafeAreaInset
  return {
    top: csa?.top ?? 0,
    bottom: csa?.bottom ?? 0,
    left: csa?.left ?? 0,
    right: csa?.right ?? 0,
  }
}

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

  document.documentElement.setAttribute(
    'data-tg-fullscreen',
    tg?.isFullscreen ? 'true' : 'false',
  )
}

export function isFullscreen() {
  return !!tg?.isFullscreen
}

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
      // ignore
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

export function initTelegram() {

  // Нативное подтверждение закрытия мини-аппа (Bot API 6.2+): защищает от
  // случайного свайпа вниз посреди заказа или правки карты.
  if (typeof tg?.isVersionAtLeast === 'function' && tg.isVersionAtLeast('6.2')) {
    tg.enableClosingConfirmation()
  }
  if (!tg) {
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