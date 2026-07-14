import { formatMoney } from '@/utils/format'
import { ChevronRight } from '@/components/menu/menuIcons'

/**
 * Шит корзины — 1:1 CartSheet из menu-redesign (proto-screens.jsx).
 *
 * НЕ draggable: обычный блок в потоке внизу страницы (flex-shrink: 0),
 * панель меню над ним сама ужимается. Тап по полосе «Заказ» раскрывает
 * тело до 60vh (transition max-height); повторный тап сворачивает.
 *
 *   • Пусто (нет ни строк черновика, ни контекстных) — одна строка-
 *     подсказка «Нажмите на позицию, чтобы добавить в заказ».
 *   • Свёрнуто — полоса «Заказ · N позиций[ · M гостей]» + шеврон вниз,
 *     футер «Итого <сумма> [Собрать]».
 *   • Раскрыто — между ними скроллящееся тело (children = CartContent),
 *     футер отделён линией, шеврон вверх.
 *
 * Стола и комментария к заказу здесь НЕТ — они в CollectSheet
 * («Оформление заказа»), который родитель открывает по кнопке.
 *
 * Props:
 *   empty        — bool; полностью пустая корзина (см. выше)
 *   meta         — строка «N позиций · M гостей» для полосы
 *   total        — сумма черновика
 *   currency
 *   expanded     — bool (контролируется родителем)
 *   onToggle     — () => void
 *   submitLabel  — «Собрать» / «Сохранить» / «Добавить» / «…»
 *   canSubmit, submitting
 *   onSubmit     — () => void (родитель решает: CollectSheet или сразу)
 *   children     — содержимое корзины (CartContent + прочее)
 */
export default function CartSheet({
  empty = false,
  meta = '',
  total = 0,
  currency = 'RUB',
  expanded = false,
  onToggle,
  submitLabel = 'Собрать',
  canSubmit = false,
  submitting = false,
  onSubmit,
  children,
}) {
  if (empty) {
    return (
      <div className="obc-empty">Нажмите на позицию, чтобы добавить в заказ</div>
    )
  }

  return (
    <div className={`obc-sheet${expanded ? ' obc-sheet--expanded' : ''}`}>
      <button type="button" className="obc-bar" onClick={onToggle}>
        <span className="obc-bar-title">Заказ</span>
        <span className="obc-bar-meta">{meta}</span>
        <span
          className={`obc-bar-chev${expanded ? ' obc-bar-chev--up' : ''}`}
          aria-hidden
        >
          <ChevronRight width={18} height={18} />
        </span>
      </button>

      {expanded && <div className="obc-body">{children}</div>}

      <div className="obc-footer">
        <span className="obc-footer-label">Итого</span>
        <span className="obc-footer-total">{formatMoney(total, currency)}</span>
        <button
          type="button"
          className="obc-footer-btn"
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
