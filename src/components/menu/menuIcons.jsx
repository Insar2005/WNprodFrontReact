/**
 * Outline SVG icons for the menu / order screens.
 *
 * Style matches the rest of the app (see views/profile/icons.jsx):
 *   24×24 viewBox, stroke-only, strokeWidth 1.8, currentColor, round caps.
 * Size defaults per icon but every one accepts width/height/style overrides.
 *
 * Kept in one file (not co-located per view) because both MenuEditor and
 * OrderBuilder — plus the shared tree components — need the same glyphs,
 * and a single import avoids duplicate inline SVGs.
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

/** Chevron right — subcategory drilldown, cart expand. */
export function ChevronRight({ width = 18, height = 18, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Plus — FAB, add guest, add subcategory. */
export function PlusIcon({ width = 18, height = 18, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Minus — cart stepper, slide-out decrement flag. */
export function MinusIcon({ width = 18, height = 18, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M5 12h14" />
    </svg>
  )
}

/** Pencil — edit-mode item hint, category edit, comment chip. */
export function PencilIcon({ width = 16, height = 16, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  )
}

/** Info (circle-i) — pick-mode item detail button. */
export function InfoIcon({ width = 22, height = 22, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.75" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Search (magnifier) — menu search field. */
export function SearchIcon({ width = 18, height = 18, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M15.8 15.8L20 20" />
    </svg>
  )
}

/** Close (×) — clear search, close sheets. */
export function CloseIcon({ width = 16, height = 16, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** Chair — table plate in the order cart (replaces the 🪑 emoji). */
export function ChairIcon({ width = 18, height = 18, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M7 3.5h10" />
      <path d="M7 3.5v8.5M17 3.5v8.5" />
      <path d="M5.5 12h13" />
      <path d="M6.5 12v8M17.5 12v8" />
      <path d="M6.5 15.5h11" />
    </svg>
  )
}
