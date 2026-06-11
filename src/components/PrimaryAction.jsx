import { useLocation, useNavigate, useMatches } from 'react-router-dom'
import { useShiftStore } from '@/stores/shift'
import { useWorkplaceStore } from '@/stores/workplace'

/**
 * Floating primary CTA: "Взять заказ" (shift open) or "Открыть смену".
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Visibility was a computed off route.meta.hideBottomNav + route.name.
 *   Here: hideBottomNav comes from useMatches().handle (same source App
 *   uses), and the "hide on these screens" check uses pathname instead of
 *   route.name (React Router has no names).
 * - shift.isOpen was a computed getter → useShiftStore(s => …) selector so
 *   the button re-renders when the shift opens/closes.
 * - router.push({name}) → navigate(path).
 * ─────────────────────────────────────────────────────────────────────
 */

// Top-level screens where the action makes no sense.
const HIDE_ON_PATHS = new Set(['/profile', '/shifts'])

export default function PrimaryAction() {
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMatches()

  // Subscribe so the label/visibility update when these change.
  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const currentId = useWorkplaceStore((s) => s.currentId)

  const hideBottomNav = matches.some((m) => m.handle?.hideBottomNav === true)

  const visible =
    !hideBottomNav && !HIDE_ON_PATHS.has(location.pathname) && !!currentId

  if (!visible) return null

  const label = isOpen ? '➕ Взять заказ' : '▶ Открыть смену'

  const onClick = () => {
    if (isOpen) {
      // Jump straight into the order builder; user picks a table inside.
      navigate('/order-builder')
    } else {
      // Shift closed — go to Shifts so they can review defaults first.
      navigate('/shifts')
    }
  }

  return (
    <button
      className={
        isOpen ? 'primary-action' : 'primary-action primary-action--accent'
      }
      onClick={onClick}
    >
      <span className="primary-action-label">{label}</span>
    </button>
  )
}