import { formatMoney } from '@/utils/format'

/**
 * Read-only карточка позиции (OrderBuilder → тап ⓘ) — 1:1 ItemViewModal
 * из menu-redesign (proto-modals.jsx).
 *
 * Низ-шит: заголовок = название блюда; recessed-плашка с рядками
 * Цена (accent) / Порция / Категория; ниже — Описание; в футере одна
 * акцентная кнопка «Добавить в заказ» (или «Добавить ещё · в заказе N»,
 * если у активного гостя уже есть это блюдо).
 *
 * Использует общий каркас .sheet-overlay/.sheet (safe-area и клавиатурные
 * фиксы приходят оттуда), содержимое — ivm-* из menu-tree.css.
 *
 * Props:
 *   item      — { title, price, portion?, description? }
 *   pathLabel — «Категория › Подкатегория» (может быть null)
 *   qty       — количество у активного гостя
 *   currency
 *   onClose   — () => void
 *   onAdd     — () => void  (добавить +1; модалка остаётся открытой,
 *               как в прототипе — счётчик в кнопке обновится)
 */
export default function ItemViewModal({
  item,
  pathLabel = null,
  qty = 0,
  currency = 'RUB',
  onClose,
  onAdd,
}) {
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">{item?.title}</h3>
          <button
            className="sheet-close"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="sheet-form">
          <div className="ivm-card">
            <div className="ivm-row">
              <span className="ivm-label">Цена</span>
              <span className="ivm-value ivm-value--accent">
                {formatMoney(item.price, currency)}
              </span>
            </div>
            {item.portion && (
              <div className="ivm-row">
                <span className="ivm-label">Порция</span>
                <span className="ivm-value">{item.portion}</span>
              </div>
            )}
            {pathLabel && (
              <div className="ivm-row">
                <span className="ivm-label">Категория</span>
                <span className="ivm-value">{pathLabel}</span>
              </div>
            )}
          </div>

          {item.description && (
            <div>
              <span className="ivm-desc-label">Описание</span>
              <p className="ivm-desc">{item.description}</p>
            </div>
          )}

          <div className="sheet-actions">
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => onAdd?.()}
            >
              {qty > 0 ? `Добавить ещё · в заказе ${qty}` : 'Добавить в заказ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
