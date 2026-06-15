import { formatMoney } from '@/utils/format'

/**
 * Info ⓘ icon — only icon used in the menu row. Used in pick mode to
 * open EditAndSeeMoreModal in view-mode (read-only details). The rest
 * of the row stays a tap-to-add target.
 *
 * Inline here (not in a shared icons file) because it's the only one
 * the row needs and it's tiny.
 */
function InfoIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

/**
 * Universal menu item row. Used by both MenuEditorView (mode="edit") and
 * OrderBuilderView (mode="pick").
 *
 * Layout (from the designer mockups):
 *   [ⓘ]  Title                     portion
 *                                     price
 *
 *   - ⓘ on the LEFT — pick mode only. Tap stops propagation and calls
 *     onInfo(item). The row's main onClick (onAdd in pick mode) does NOT
 *     fire when ⓘ is tapped.
 *   - Title in the middle, ellipses if too long.
 *   - Right column: portion on top (small, muted), price below (bold,
 *     accent-colored). If portion is empty, price sits vertically
 *     centered in the right column.
 *
 * Props
 *   item       — { id, title, price, portion, is_active, description }
 *   currency   — passed to formatMoney
 *   mode       — 'edit' (default) | 'pick'
 *   quantity   — pick-mode only; shown as a small "×N" badge next to title
 *   onClick    — primary tap handler. In edit: open edit modal; in pick:
 *                add to cart.
 *   onInfo     — pick-mode only; called when ⓘ is tapped (open the
 *                view-modal). If not provided, the ⓘ button is hidden —
 *                callers that haven't wired the modal yet can omit it.
 */
export default function MenuItemRow({
  item,
  currency = 'RUB',
  mode = 'edit',
  quantity = 0,
  onClick,
  onInfo,
}) {
  const isPick = mode === 'pick'
  const showInfo = isPick && typeof onInfo === 'function'
  const hidden = mode === 'edit' && !item.is_active

  const handleInfo = (e) => {
    // Stop the tap from bubbling to the row (which would add to cart).
    e.stopPropagation()
    onInfo?.(item)
  }

  const cls = [
    'mir-row',
    hidden ? 'mir-row--hidden' : '',
    isPick && quantity > 0 ? 'mir-row--in-cart' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} onClick={() => onClick?.(item)}>
      {showInfo && (
        <button
          type="button"
          className="mir-info-btn"
          aria-label="Подробнее"
          onClick={handleInfo}
        >
          <InfoIcon />
        </button>
      )}

      <div className="mir-title-wrap">
        <span className="mir-title">{item.title}</span>
        {hidden && <span className="mir-badge">скрыто</span>}
        {isPick && quantity > 0 && (
          <span className="mir-qty">×{quantity}</span>
        )}
      </div>

      <div
        className={item.portion ? 'mir-right mir-right--stacked' : 'mir-right'}
      >
        {item.portion && <span className="mir-portion">{item.portion}</span>}
        <span className="mir-price">{formatMoney(item.price, currency)}</span>
      </div>
    </div>
  )
}