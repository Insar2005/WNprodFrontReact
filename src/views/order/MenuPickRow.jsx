import { formatMoney } from '@/utils/format'

/**
 * Menu row for the order builder. (Was MenuPickRow.vue.)
 * Whole row is a button; tap adds to cart. Badge shows current quantity.
 * $emit('add', item) → onAdd(item).
 */
export default function MenuPickRow({ item, currency = 'RUB', quantity = 0, onAdd }) {
  return (
    <button
      className={quantity > 0 ? 'mpr-row mpr-row--in-cart' : 'mpr-row'}
      onClick={() => onAdd?.(item)}
    >
      <div className="mpr-main">
        <div className="mpr-title">
          <span>{item.title}</span>
          {quantity > 0 && <span className="mpr-badge">×{quantity}</span>}
        </div>
        {(item.description || item.portion) && (
          <div className="mpr-meta">
            {item.portion && <span className="mpr-portion">{item.portion}</span>}
            {item.description && <span className="mpr-desc">{item.description}</span>}
          </div>
        )}
      </div>
      <div className="mpr-price">{formatMoney(item.price, currency)}</div>
    </button>
  )
}