import { useMemo, useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { formatMoney } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'
import { ChairIcon, PencilIcon } from '@/components/menu/menuIcons'
import TablePickerSheet from './TablePickerSheet'

/**
 * «Оформление заказа» — CollectSheet из menu-redesign
 * (proto-order-flow.jsx). Открывается кнопкой «Собрать» в корзине.
 *
 *   • СТОЛ — плашка с текущим выбором («Стол №4 · Зал» / «Без стола»);
 *     тап открывает TablePickerSheet — SVG-карту залов (занятые столы
 *     недоступны, «Без стола» в футере). Решение владельца: карта вместо
 *     сетки номеров из прототипа.
 *   • КОММЕНТАРИЙ К ЗАКАЗУ — textarea (2 строки, до 2000).
 *   • Строка «N позиций · итого», футер [Отмена][Оформить заказ].
 *
 * В режиме правки закрытого заказа (mode="edit") секции стола нет —
 * стол не меняется; остаются комментарий и итог, кнопка «Сохранить».
 *
 * Props:
 *   mode           — 'new' | 'edit'
 *   initialTableId — предвыбранный стол (посев из ?table_id)
 *   initialComment — текущий комментарий черновика
 *   count, total, currency
 *   submitting     — блокирует кнопки, меняет лейбл
 *   onClose        — () => void
 *   onConfirm      — ({ tableId, comment }) => void
 */
export default function CollectSheet({
  mode = 'new',
  initialTableId = null,
  initialComment = '',
  count = 0,
  total = 0,
  currency = 'RUB',
  submitting = false,
  onClose,
  onConfirm,
}) {
  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)

  const [tableId, setTableId] = useState(initialTableId)
  const [comment, setComment] = useState(initialComment || '')
  const [pickerOpen, setPickerOpen] = useState(false)

  // «Стол №4 · Летний зал» / «Без стола»
  const tableLabel = useMemo(() => {
    if (tableId == null) return null
    const t = tables.find((x) => x.id === tableId)
    if (!t) return null
    const hall = halls.find((h) => h.id === t.hall_id)
    return `Стол №${t.number}${hall ? ` · ${hall.name}` : ''}`
  }, [tableId, tables, halls])

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  const confirmLabel = submitting
    ? mode === 'edit'
      ? 'Сохраняем…'
      : 'Оформляем…'
    : mode === 'edit'
      ? 'Сохранить'
      : 'Оформить заказ'

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">
            {mode === 'edit' ? 'Изменение заказа' : 'Оформление заказа'}
          </h3>
          <button
            className="sheet-close"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="sheet-form">
          {mode !== 'edit' && (
            <div className="clx-section">
              <div className="clx-label">Стол</div>
              <button
                type="button"
                className="clx-plate"
                onClick={() => setPickerOpen(true)}
              >
                <span className="clx-plate-ico" aria-hidden>
                  <ChairIcon width={18} height={18} />
                </span>
                <span
                  className={`clx-plate-text${tableLabel ? '' : ' clx-plate-text--none'}`}
                >
                  {tableLabel || 'Без стола'}
                </span>
                <span className="clx-plate-edit" aria-hidden>
                  <PencilIcon width={15} height={15} />
                </span>
              </button>
            </div>
          )}

          <div className="clx-section">
            <div className="clx-label">Комментарий к заказу</div>
            <textarea
              className="cm-textarea"
              rows={2}
              maxLength={2000}
              placeholder="Например: подать десерт после горячего"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          <div className="clx-summary">
            <span>
              {count} {pluralize(count, ['позиция', 'позиции', 'позиций'])}
            </span>
            <span className="clx-summary-total">
              {formatMoney(total, currency)}
            </span>
          </div>

          <div className="sheet-actions">
            <button
              className="btn btn--ghost"
              disabled={submitting}
              onClick={() => onClose?.()}
            >
              Отмена
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={submitting}
              onClick={() => onConfirm?.({ tableId, comment: comment.trim() })}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <TablePickerSheet
        visible={pickerOpen}
        currentTableId={tableId}
        freeOnly
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          setTableId(id)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}