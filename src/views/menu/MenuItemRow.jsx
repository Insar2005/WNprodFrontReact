import { formatMoney } from '@/utils/format'

/**
 * Menu item row in the editor. (Was MenuItemRow.vue.)
 * $emit('edit', item) → onEdit(item).
 */
export default function MenuItemRow({ item, currency = 'RUB', onEdit }) {
  return (
    <div
      className={item.is_active ? 'mir-row' : 'mir-row mir-row--inactive'}
      onClick={() => onEdit?.(item)}
    >
      <div className="mir-main">
        <div className="mir-title">
          <span>{item.title}</span>
          {!item.is_active && <span className="mir-badge">скрыто</span>}
        </div>
        {(item.description || item.portion) && (
          <div className="mir-meta">
            {item.portion && <span className="mir-portion">{item.portion}</span>}
            {item.description && (
              <span className="mir-description">{item.description}</span>
            )}
          </div>
        )}
      </div>
      <div className="mir-price">{formatMoney(item.price, currency)}</div>
    </div>
  )
}