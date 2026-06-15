/**
 * Outline SVG icons used by ProfileView.
 *
 * Style rules (match the screenshot reference):
 *   - 22×22 default size, stroke-only (no fill)
 *   - strokeWidth=1.8, currentColor — adopts parent's color
 *   - rounded line caps/joins for the soft, hand-drawn feel
 *
 * Keeping these tiny + co-located so they tree-shake well and the
 * profile view stays readable.
 */

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

/** Storefront — for "Текущее заведение" / current workplace row. */
export function IconStore(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M4 9.5h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z" />
      <path d="M9 21v-5h6v5" />
    </svg>
  )
}

/** Table with chairs — for "Залы и столы" / halls & tables row. */
export function IconTable(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="6" y="8" width="12" height="9" rx="2" />
      <path d="M9 8V5M15 8V5" />
      <path d="M5 17v3M19 17v3" />
    </svg>
  )
}

/** Menu / list — for "Меню" row. */
export function IconMenu(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}

/** Bell — for "Уведомления" row. */
export function IconBell(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M6 17V11a6 6 0 0 1 12 0v6" />
      <path d="M4.5 17h15" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

/** Logout / exit door — for "Выйти" row. */
export function IconLogout(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  )
}

/** Palette (paint colors) — for the accent picker section icon, optional. */
export function IconPalette(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M12 3a9 9 0 1 0 0 18 1.5 1.5 0 0 0 1.5-1.5c0-.4-.15-.78-.4-1.05a1.5 1.5 0 0 1 1.1-2.45H17a4 4 0 0 0 4-4c0-4.97-4.03-9-9-9Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="11" cy="7" r="1" />
      <circle cx="16" cy="9" r="1" />
    </svg>
  )
}

/** Hammer / wrench — for Dev tools row (mock mode). */
export function IconTools(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M14 6l4 4-9 9-4 1 1-4 8-10Z" />
      <path d="M13 7l4 4" />
    </svg>
  )
}

/** Share — for "Поделиться меню и залами" row. */
export function IconShare(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8 11l8-4M8 13l8 4" />
    </svg>
  )
}

/** Building / multi-workplace — for "Все заведения" row. */
export function IconBuilding(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
      <path d="M10 21v-3h4v3" />
    </svg>
  )
}

/** Chevron right — used in action rows. */
export function IconChevron(props) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Check — used on the active accent swatch. */
export function IconCheck(props) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  )
}