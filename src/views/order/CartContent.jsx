import { formatMoney } from '@/utils/format'
import { PencilIcon, PlusIcon, MinusIcon } from '@/components/menu/menuIcons'

/**
 * Содержимое корзины — 1:1 GuestCard + CartLine из menu-redesign
 * (proto-screens.jsx).
 *
 *   • ВСЕГДА GuestCard (в т.ч. один гость): акцентная шапка с подытогом;
 *     при одном госте — без номерного кружка, имя «Один чек».
 *   • CartLine: название, «цена × кол-во» (mute), справа степпер
 *     (− кол-во +) и сумма строки (жирная). Ниже — «＋ Комментарий»,
 *     либо чип комментария (accent-fill, карандаш).
 *
 * Комментарии идут через родительский CommentModal (чипы из
 * comment_chips позиции) — onOpenComment(lineItem).
 *
 * Сохранено из прежней версии: read-only контекстные строки (режим
 * «добавить к заказу»), итог по заказу при наличии контекста.
 *
 * Props:
 *   items          — строки черновика ({id, menu_item_id, title, price,
 *                    quantity, comment, guest})
 *   contextItems   — read-only строки уже существующего заказа
 *   currency, guestCount
 *   onInc/onDec    — (lineId) => void
 *   onOpenComment  — (lineItem) => void
 */
export default function CartContent({
  items,
  contextItems = [],
  currency = 'RUB',
  guestCount = 1,
  onInc,
  onDec,
  onOpenComment,
}) {
  const single = guestCount <= 1

  const CartLine = ({ item, last }) => (
    <div className={`cl${last ? ' cl--last' : ''}`}>
      <div className="cl-top">
        <div className="cl-info">
          <div className="cl-title">{item.title}</div>
          <div className="cl-meta">
            {formatMoney(item.price, currency)} × {item.quantity}
          </div>
        </div>
        <div className="cl-controls">
          <button
            type="button"
            className="cl-step"
            onClick={() => onDec?.(item.id)}
            aria-label="Меньше"
          >
            <MinusIcon width={16} height={16} />
          </button>
          <span className="cl-qty">{item.quantity}</span>
          <button
            type="button"
            className="cl-step"
            onClick={() => onInc?.(item.id)}
            aria-label="Больше"
          >
            <PlusIcon width={16} height={16} />
          </button>
          <span className="cl-sum">
            {formatMoney(item.price * item.quantity, currency)}
          </span>
        </div>
      </div>
      <div className="cl-comment-row">
        {item.comment ? (
          <button
            type="button"
            className="cl-comment-chip"
            onClick={() => onOpenComment?.(item)}
          >
            <PencilIcon width={14} height={14} />
            <span className="cl-comment-text">{item.comment}</span>
          </button>
        ) : (
          <button
            type="button"
            className="cl-add-comment"
            onClick={() => onOpenComment?.(item)}
          >
            <PlusIcon width={16} height={16} /> Комментарий
          </button>
        )}
      </div>
    </div>
  )

  const ContextLine = ({ item, last }) => (
    <div className={`cl cl--ctx${last ? ' cl--last' : ''}`}>
      <div className="cl-top">
        <div className="cl-info">
          <div className="cl-title">{item.title}</div>
          <div className="cl-meta">уже в заказе · × {item.quantity}</div>
        </div>
        <span className="cl-sum">
          {formatMoney(item.total_price ?? item.price * item.quantity, currency)}
        </span>
      </div>
    </div>
  )

  const lineSum = (it) => it.total_price ?? it.price * it.quantity
  const sumOf = (arr) => arr.reduce((s, it) => s + lineSum(it), 0)
  const hasCtx = contextItems.length > 0
  const grand = sumOf(contextItems) + sumOf(items)

  if (items.length === 0 && !hasCtx) {
    return (
      <div className="cc-cart">
        <div className="cc-empty">
          <p>Корзина пуста</p>
          <p className="cc-empty-sub">Нажмите на позицию, чтобы добавить в заказ</p>
        </div>
      </div>
    )
  }

  const guests = Array.from({ length: guestCount }, (_, i) => i + 1)

  return (
    <div className="cc-cart">
      {guests.map((g) => {
        const ctx = contextItems.filter((it) => (it.guest || 1) === g)
        const guestItems = items.filter((it) => (it.guest || 1) === g)
        // При нескольких гостях пустых не показываем; единственная
        // карточка «Один чек» рисуется всегда (в ней и лежит всё).
        if (!single && ctx.length === 0 && guestItems.length === 0) return null
        const subtotal = sumOf(ctx) + sumOf(guestItems)
        const rows = [
          ...ctx.map((it) => ['ctx', it]),
          ...guestItems.map((it) => ['new', it]),
        ]
        return (
          <div className="gcard" key={g}>
            <div className="gcard-head">
              {!single && <span className="gcard-badge">{g}</span>}
              <span className="gcard-name">
                {single ? 'Один чек' : `Гость ${g}`}
              </span>
              <span className="gcard-subtotal">
                {formatMoney(subtotal, currency)}
              </span>
            </div>
            <div className="gcard-body">
              {rows.length > 0 ? (
                rows.map(([kind, it], idx) => {
                  const last = idx === rows.length - 1
                  return kind === 'ctx' ? (
                    <ContextLine key={`ctx-${it.id}`} item={it} last={last} />
                  ) : (
                    <CartLine key={it.id} item={it} last={last} />
                  )
                })
              ) : (
                <div className="gcard-empty">Пусто</div>
              )}
            </div>
          </div>
        )
      })}
      {hasCtx && (
        <div className="cc-grand">
          <span className="cc-grand-label">Итого по заказу</span>
          <span className="cc-grand-total">{formatMoney(grand, currency)}</span>
        </div>
      )}
    </div>
  )
}
