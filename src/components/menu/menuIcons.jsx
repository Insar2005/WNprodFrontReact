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

/** Bell — nearest reminder row on the Home screen. */
export function BellIcon({ width = 19, height = 19, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

/** Check — reminder done, selected venue in the switcher. */
export function CheckIcon({ width = 16, height = 16, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}

/** Chevron down — venue switcher pill (rotates 180° when open). */
export function ChevronDown({ width = 13, height = 13, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="m5 9 7 7 7-7" />
    </svg>
  )
}

/** Share (tray + arrow up) — «Поделиться отчётом» in the shift report. */
export function ShareIcon({ width = 19, height = 19, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M12 14V3" />
      <path d="m8.5 6.5 3.5-3.5 3.5 3.5" />
      <path d="M7 10H5.5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H17" />
    </svg>
  )
}

/** Trash — удаление позиции из заказа (карточка заказа). */
export function TrashIcon({ width = 17, height = 17, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7 7.4 19a1 1 0 0 0 1 .93h7.2a1 1 0 0 0 1-.93L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  )
}

/** Map/tables — «Другой стол» в карточке заказа (геометрия nav-иконки Карта). */
export function MapIcon({ width = 17, height = 17, ...props }) {
  return (
    <svg width={width} height={height} {...BASE} {...props}>
      <rect x="3" y="9" width="3" height="6" rx="0.8" />
      <rect x="18" y="9" width="3" height="6" rx="0.8" />
      <rect x="7.5" y="6" width="9" height="12" rx="1.5" />
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
