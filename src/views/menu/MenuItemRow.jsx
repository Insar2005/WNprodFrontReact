import { useEffect, useRef } from 'react'
import { formatMoney } from '@/utils/format'

/**
 * Universal menu item row. Renders the same item in two modes:
 *   • `pick` — used in OrderBuilder. Tap = add to cart. Shows an info
 *     button (ⓘ) on the left if onInfo is provided. Optional pathLabel
 *     under the title — the category breadcrumb, shown only in search
 *     results so the user knows where a found dish lives.
 *   • `edit` — used in the menu editor. Tap = open form. Shows a
 *     "скрыто" badge for inactive items; the whole row dims.
 *
 * `highlighted` (July 2026): when true, the row pulses briefly with the
 * accent color AND scrolls itself into view. Used by the search flow so
 * that a picked search result is easy to find in its category. The prop
 * is controlled by the caller (via useMenuStore.highlightedItemId); this
 * component only reacts to it.
 *
 * Props:
 *   item        — { id, title, price, portion, is_active, ... }
 *   currency    — RUB/USD/... for formatMoney
 *   mode        — 'pick' | 'edit'
 *   quantity    — items already in the cart (pick mode); shows "×N" badge
 *   pathLabel   — optional "Категория › Подкатегория" string (search only)
 *   highlighted — bool; true = pulse & scroll into view
 *   onClick     — (item) => void; row tapped
 *   onInfo      — (item) => void; info button tapped (pick mode only)
 */
export default function MenuItemRow({
  item,
  currency = 'RUB',
  mode = 'pick',
  quantity = 0,
  pathLabel = null,
  highlighted = false,
  onClick,
  onInfo,
}) {
  const rowRef = useRef(null)

  // Scroll into view whenever highlighted flips ON. useEffect is right
  // here because we're synchronizing with an external system (DOM
  // scroll position) — not pushing derived state back into React.
  useEffect(() => {
    if (highlighted && rowRef.current) {
      // 'center' keeps some context above/below visible; 'smooth' feels
      // like a follow-up to the animation the search dropdown ran.
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

  const hidden = mode === 'edit' && item.is_active === false
  const inCart = mode === 'pick' && quantity > 0

  const cls = [
    'mir-row',
    `mir-row--${mode}`,
    hidden ? 'mir-row--hidden' : '',
    inCart ? 'mir-row--in-cart' : '',
    highlighted ? 'mir-row--highlight' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = () => {
    onClick?.(item)
  }

  const handleInfo = (e) => {
    // Don't bubble — otherwise the row's onClick fires and adds to cart.
    e.stopPropagation()
    onInfo?.(item)
  }

  return (
    <div ref={rowRef} className={cls} onClick={handleClick}>
      {mode === 'pick' && onInfo && (
        <button
          type="button"
          className="mir-info-btn"
          onClick={handleInfo}
          aria-label="Подробнее"
        >
          ⓘ
        </button>
      )}

      <div className="mir-main">
        <div className="mir-title-line">
          <span className="mir-title">{item.title}</span>
          {hidden && <span className="mir-hidden-badge">скрыто</span>}
          {inCart && <span className="mir-qty-badge">×{quantity}</span>}
        </div>
        {pathLabel && (
          <span className="mir-path">{pathLabel}</span>
        )}
      </div>

      <div className="mir-right">
        {item.portion && <span className="mir-portion">{item.portion}</span>}
        <span className="mir-price">{formatMoney(item.price, currency)}</span>
      </div>
    </div>
  )
}