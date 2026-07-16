import { useLocation, useNavigate, useMatches } from 'react-router-dom'
import { useShiftStore } from '@/stores/shift'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { PlusIcon } from '@/components/menu/menuIcons'

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

// The floating CTA only makes sense on Главная and Карта — everywhere
// else (Инструменты sub-pages, Профиль, Смены) it would just overlap the
// content, so we show it ONLY on these paths.
const SHOW_ON_PATHS = new Set(['/home', '/map'])

export default function PrimaryAction() {
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMatches()

  // Subscribe so the label/visibility update when these change.
  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const currentId = useWorkplaceStore((s) => s.currentId)

  const hideBottomNav = matches.some((m) => m.handle?.hideBottomNav === true)

  // Hide while a sheet/overlay or confirm/prompt dialog is open, so the CTA
  // never overlaps (or gets tapped through) the order details sheet buttons.
  const overlayOpen = useUiStore(
    (s) => s.overlayCount > 0 || !!s.confirmDialog || !!s.promptDialog,
  )

  // На Главной при закрытой смене FAB не показываем — там CTA-карточка
  // «Открыть» (прототип waiter-note-unified). На Карте прежнее поведение.
  const visible =
    !hideBottomNav &&
    SHOW_ON_PATHS.has(location.pathname) &&
    !!currentId &&
    !overlayOpen &&
    (isOpen || location.pathname !== '/home')

  if (!visible) return null

  const label = isOpen ? 'Взять заказ' : 'Открыть смену'

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
      {isOpen && <PlusIcon width={18} height={18} />}
      <span className="primary-action-label">{label}</span>
    </button>
  )
}
