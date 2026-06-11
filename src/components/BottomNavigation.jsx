import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

/**
 * Bottom navigation bar with a sliding pill indicator.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - <router-link> → <NavLink> (react-router). We still compute activeIdx
 *   ourselves because the sliding indicator needs the active tab's INDEX,
 *   not just a boolean — NavLink's isActive alone can't drive the pill.
 * - Icons were Vue render functions (h('svg', …)). Here they're plain JSX
 *   SVG components. Same paths, same 24x24 stroke style via currentColor.
 * - useRoute().path → useLocation().pathname.
 * - The "Главная" tab points to /home (our React route), whereas the Vue
 *   app used '/'. Everything else matches the Vue paths.
 * ─────────────────────────────────────────────────────────────────────
 */

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function HomeIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9.5a.5.5 0 0 0 .5.5H9v-6h6v6h3.5a.5.5 0 0 0 .5-.5V10" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <rect x="3" y="9" width="3" height="6" rx="0.8" />
      <rect x="18" y="9" width="3" height="6" rx="0.8" />
      <rect x="7.5" y="6" width="9" height="12" rx="1.5" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  )
}

function ShiftIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M10 3h4" />
      <path d="M12 3v2.5" />
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13 15 11" />
      <path d="M12 13v-3" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.8 4-5.5 7-5.5s5.5 1.7 7 5.5" />
    </svg>
  )
}

const items = [
  { to: '/home', Icon: HomeIcon, label: 'Главная' },
  { to: '/map', Icon: TableIcon, label: 'Карта' },
  { to: '/notes', Icon: NoteIcon, label: 'Заметки' },
  { to: '/shifts', Icon: ShiftIcon, label: 'Смены' },
  { to: '/profile', Icon: ProfileIcon, label: 'Профиль' },
]

export default function BottomNavigation() {
  const { pathname } = useLocation()

  // Some old WebViews don't support backdrop-filter → fall back to an
  // opaque background. CSS.supports is synchronous, so compute it lazily
  // in the useState initializer (runs once) — no effect needed, which
  // keeps the newer react-hooks lint happy.
  const [noBlur] = useState(() => {
    if (typeof CSS === 'undefined' || !CSS.supports) return false
    const supports =
      CSS.supports('backdrop-filter', 'blur(10px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(10px)')
    return !supports
  })

  // Match the deepest tab whose path is a prefix of the current route.
  // Sub-routes (e.g. /order-builder) have hideBottomNav so the bar isn't
  // shown there anyway, but this keeps the indicator sensible otherwise.
  const activeIdx = useMemo(() => {
    // Exact match first.
    for (let i = 0; i < items.length; i++) {
      if (items[i].to === pathname) return i
    }
    // Longest prefix match.
    let bestIdx = -1
    let bestLen = 0
    for (let i = 0; i < items.length; i++) {
      const to = items[i].to
      if (pathname.startsWith(to) && to.length > bestLen) {
        bestIdx = i
        bestLen = to.length
      }
    }
    return bestIdx
  }, [pathname])

  // Each tab is (100% / N) wide. The pill is 10% wide (half a tab at N=5);
  // `left` sets its left edge, so center it in the active tab by offsetting
  // a further quarter-tab (matches the Vue math).
  const tabWidthPct = 100 / items.length
  const indicatorLeft =
    activeIdx >= 0
      ? activeIdx * tabWidthPct + tabWidthPct / 2 - tabWidthPct / 4
      : 0

  return (
    <nav className={noBlur ? 'bottom-nav bottom-nav--no-blur' : 'bottom-nav'}>
      <div className="nav-content">
        <span
          className="indicator"
          style={{ left: `${indicatorLeft}%`, opacity: activeIdx >= 0 ? 1 : 0 }}
          aria-hidden="true"
        />
        {items.map(({ to, Icon, label }, idx) => (
          <NavLink
            key={to}
            to={to}
            className={
              idx === activeIdx ? 'nav-item nav-item--active' : 'nav-item'
            }
          >
            <span className="nav-icon-wrap">
              <Icon />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}