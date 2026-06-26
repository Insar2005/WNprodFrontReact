import { formatMoney } from '@/utils/format'
import { useUiStore } from '@/stores/ui'

/**
 * Cart contents. (Was CartContent.vue.)
 * Item comments are edited via the central prompt modal.
 *
 * When `guestCount` > 1 the items are grouped per guest with a subtotal
 * for each guest and a grand total at the end. With a single guest it's a
 * plain flat list (the sheet header already shows the total).
 */
export default function CartContent({
  items,
  contextItems = [],
  currency = 'RUB',
  guestCount = 1,
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

  const renderItem = (item) => (
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
  )

  // Read-only line for items already in the order (shown as context when
  // adding positions, so it's clear who already has what).
  const renderContextItem = (item) => (
    <li key={`ctx-${item.id}`} className="cc-item cc-item--ctx">
      <div className="cc-item-main">
        <div className="cc-item-title-row">
          <span className="cc-item-title">{item.title}</span>
          <span className="cc-item-price">
            {formatMoney(item.total_price ?? item.price * item.quantity, currency)}
          </span>
        </div>
        <div className="cc-item-meta">
          <span className="cc-item-unit">уже в заказе · × {item.quantity}</span>
        </div>
      </div>
    </li>
  )

  const hasCtx = contextItems.length > 0

  // Money of a line works for both new draft items (price × qty) and the
  // read-only context items already in the order (they carry total_price).
  const lineSum = (it) => it.total_price ?? it.price * it.quantity
  const sumOf = (arr) => arr.reduce((s, it) => s + lineSum(it), 0)
  // Grand total = the WHOLE order: existing items + the ones being added.
  const grand = sumOf(contextItems) + sumOf(items)

  if (items.length === 0 && !hasCtx) {
    return (
      <div className="cc-cart">
        <div className="cc-empty">
          <p>Корзина пуста</p>
          <p className="cc-empty-sub">Добавляйте позиции из меню</p>
        </div>
      </div>
    )
  }

  // Single guest → plain flat list (context first, then new items). When
  // adding to an existing order, show the combined order total at the end.
  if (guestCount <= 1) {
    return (
      <div className="cc-cart">
        <ul className="cc-items">
          {contextItems.map(renderContextItem)}
          {items.map(renderItem)}
        </ul>
        {hasCtx && (
          <div className="cc-grand">
            <span className="cc-grand-label">Итого по заказу</span>
            <span className="cc-grand-total">{formatMoney(grand, currency)}</span>
          </div>
        )}
      </div>
    )
  }

  // Multiple guests → group by guest; each shows existing (context) items
  // then the new ones. Per-guest subtotal and grand total cover the WHOLE
  // order (existing + added), so "+ Позиции" shows the full bill.
  return (
    <div className="cc-cart">
      {Array.from({ length: guestCount }, (_, i) => i + 1).map((g) => {
        const ctx = contextItems.filter((it) => (it.guest || 1) === g)
        const guestItems = items.filter((it) => (it.guest || 1) === g)
        if (ctx.length === 0 && guestItems.length === 0) return null
        const subtotal = sumOf(ctx) + sumOf(guestItems)
        return (
          <div className="cc-guest-group" key={g}>
            <div className="cc-guest-head">
              <span className="cc-guest-name">
                <span className="cc-guest-badge">{g}</span>
                Гость {g}
              </span>
              <span className="cc-guest-subtotal">{formatMoney(subtotal, currency)}</span>
            </div>
            <ul className="cc-items">
              {ctx.map(renderContextItem)}
              {guestItems.map(renderItem)}
            </ul>
          </div>
        )
      })}
      <div className="cc-grand">
        <span className="cc-grand-label">Итого по заказу</span>
        <span className="cc-grand-total">{formatMoney(grand, currency)}</span>
      </div>
    </div>
  )
}
