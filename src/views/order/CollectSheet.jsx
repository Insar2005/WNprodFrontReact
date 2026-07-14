import { useMemo, useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { formatMoney } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'

/**
 * «Оформление заказа» — 1:1 CollectSheet из menu-redesign
 * (proto-order-flow.jsx). Открывается кнопкой «Собрать» в корзине.
 *
 *   • СТОЛ — сетка чипов 4 колонки (в прототипе №1–12; здесь — реальные
 *     столы из залов). Занятые (order_id, кроме уже выбранного) —
 *     приглушены и недоступны. Первый чип «Без стола» — заказ можно
 *     оформить и без привязки (это поведение приложения, сохранено).
 *     При нескольких залах — подпись зала над каждой сеткой.
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

  const sortedHalls = useMemo(
    () => [...halls].sort((a, b) => a.position - b.position),
    [halls],
  )
  const tablesByHall = useMemo(() => {
    const m = {}
    for (const t of tables) {
      if (!m[t.hall_id]) m[t.hall_id] = []
      m[t.hall_id].push(t)
    }
    for (const id of Object.keys(m)) {
      m[id].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    }
    return m
  }, [tables])

  const isBusy = (t) => !!t.order_id && t.id !== initialTableId

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
              {sortedHalls.length <= 1 ? (
                <div className="clx-grid">
                  <button
                    type="button"
                    className={`clx-table${tableId == null ? ' clx-table--on' : ''}`}
                    onClick={() => setTableId(null)}
                  >
                    Без стола
                  </button>
                  {(tablesByHall[sortedHalls[0]?.id] || []).map((t) => {
                    const busy = isBusy(t)
                    const on = t.id === tableId
                    const cls = [
                      'clx-table',
                      on ? 'clx-table--on' : '',
                      busy ? 'clx-table--busy' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={cls}
                        disabled={busy}
                        onClick={() => setTableId(t.id)}
                      >
                        №{t.number}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <>
                  <div className="clx-grid">
                    <button
                      type="button"
                      className={`clx-table${tableId == null ? ' clx-table--on' : ''}`}
                      onClick={() => setTableId(null)}
                    >
                      Без стола
                    </button>
                  </div>
                  {sortedHalls.map((h) => {
                    const hallTables = tablesByHall[h.id] || []
                    if (hallTables.length === 0) return null
                    return (
                      <div key={h.id}>
                        <div className="clx-hall-name">{h.name}</div>
                        <div className="clx-grid">
                          {hallTables.map((t) => {
                            const busy = isBusy(t)
                            const on = t.id === tableId
                            const cls = [
                              'clx-table',
                              on ? 'clx-table--on' : '',
                              busy ? 'clx-table--busy' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')
                            return (
                              <button
                                key={t.id}
                                type="button"
                                className={cls}
                                disabled={busy}
                                onClick={() => setTableId(t.id)}
                              >
                                №{t.number}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
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
    </div>
  )
}
