import { formatMoney } from '@/utils/format'
import { useUiStore } from '@/stores/ui'

/**
 * Cart contents. (Was CartContent.vue.)
 * Item comments are edited via the central prompt modal (anchored at the
 * top, above the keyboard). $emit('inc'|'dec'|'update-comment') → callbacks.
 */
export default function CartContent({
  items,
  currency = 'RUB',
  onInc,
  onDec,
  onUpdateComment,
}) {
  const editComment = async (item) => {
    const value = await useUiStore.getState().prompt({
      title: `Комментарий: ${item.title}`,
      initial: item.comment || '',
      placeholder: 'Например: без сахара',
      multiline: true,
      rows: 3,
      maxLength: 2000,
      confirmText: 'Сохранить',
    })
    if (value === null) return
    onUpdateComment?.(item.id, value.trim() || null)
  }

  if (items.length === 0) {
    return (
      <div className="cc-cart">
        <div className="cc-empty">
          <p>Корзина пуста</p>
          <p className="cc-empty-sub">Добавляйте позиции из меню</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cc-cart">
      <ul className="cc-items">
        {items.map((item) => (
          <li key={item.id} className="cc-item">
            <div className="cc-item-main">
              <div className="cc-item-title-row">
                <span className="cc-item-title">{item.title}</span>
                <span className="cc-item-price">
                  {formatMoney(item.price * item.quantity, currency)}
                </span>
              </div>
              <div className="cc-item-meta">
                <span className="cc-item-unit">
                  {formatMoney(item.price, currency)} × {item.quantity}
                </span>
              </div>
              <div className="cc-item-comment-row">
                {!item.comment ? (
                  <button className="cc-add-comment" onClick={() => editComment(item)}>
                    + Комментарий
                  </button>
                ) : (
                  <button className="cc-comment-display" onClick={() => editComment(item)}>
                    💬 {item.comment}
                  </button>
                )}
              </div>
            </div>

            <div className="cc-item-actions">
              <button className="cc-qty-btn" onClick={() => onDec?.(item.id)} aria-label="Меньше">
                −
              </button>
              <span className="cc-qty">{item.quantity}</span>
              <button className="cc-qty-btn" onClick={() => onInc?.(item.id)} aria-label="Больше">
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}