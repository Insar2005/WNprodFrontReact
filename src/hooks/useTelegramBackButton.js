import { useEffect, useRef } from 'react'
import { showBackButton } from '@/utils/telegram'

/**
 * Show Telegram's native back button while this component is mounted,
 * and route taps to the given handler.
 *
 * The button lives in Telegram's own header (top-left, where the "×"
 * close sits by default) — freeing our page headers from having their
 * own "←" arrow AND collision with the safe-area at the top of the
 * screen.
 *
 * Usage:
 *   const nav = useNavigate()
 *   useTelegramBackButton(() => nav(-1))
 *
 * The `enabled` flag lets a screen conditionally attach the button —
 * pass false to skip (e.g. on the home screen where there's nothing to
 * go back to).
 *
 * ── Why the callback is captured in a ref ────────────────────────────
 * The Telegram SDK holds the callback by identity. If we bound a fresh
 * arrow function on every render, the effect would tear down and re-set
 * the listener each time, and the click handler could briefly disappear
 * (or fire the stale one). Ref-indirection lets us bind ONCE and always
 * call the latest handler.
 *
 * ── Why the ref is written in useEffect, not during render ──────────
 * React 19 + react-hooks/refs lint forbids writing `ref.current` during
 * render. We update it in an effect that runs after every render — the
 * value is only READ inside the Telegram callback, which fires on user
 * interaction (way after render), so this is safe: the callback always
 * sees the latest handler.
 * ─────────────────────────────────────────────────────────────────────
 */
export function useTelegramBackButton(onBack, { enabled = true } = {}) {
  const handlerRef = useRef(onBack)

  // Keep the ref pointed at the latest handler. Runs after every render;
  // no synchronous work, just a pointer swap. The Telegram callback
  // reads handlerRef.current only when the user taps the back button,
  // which happens after this effect has already applied.
  useEffect(() => {
    handlerRef.current = onBack
  })

  useEffect(() => {
    if (!enabled) return undefined
    const cleanup = showBackButton(() => {
      handlerRef.current?.()
    })
    return cleanup
  }, [enabled])
}