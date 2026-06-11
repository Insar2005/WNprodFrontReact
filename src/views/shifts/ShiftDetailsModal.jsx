import { useState } from 'react'
import { formatDate, formatTime, formatDuration, formatMoney } from '@/utils/format'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'

/**
 * Shift details sheet. (Was ShiftDetailsModal.vue.)
 * Shows aggregates; delete is offered for closed shifts only.
 * $emit('close') → onClose().
 */
export default function ShiftDetailsModal({ shift, onClose }) {
  const [busy, setBusy] = useState(false)

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить смену?',
      message: 'Все заказы и позиции этой смены будут удалены безвозвратно.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useShiftStore.getState().remove(shift.id)
      ui.toastSuccess('Смена удалена')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  const title = shift.is_closed
    ? `Смена ${formatDate(shift.start_time)}`
    : 'Текущая смена'

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">{title}</h3>
          <button className="sheet-close" onClick={() => onClose?.()} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="sdm-content">
          <div className="sdm-block sdm-block--highlight">
            <span className="sdm-label">Заработано</span>
            <span className="sdm-value sdm-value--big">
              {formatMoney(shift.total_pay_for_shift, shift.currency)}
            </span>
            <span className="sdm-sub">
              {shift.shift_type === 'percent'
                ? `${shift.service_percent}% от кассы`
                : 'фиксированная ставка'}
            </span>
          </div>

          <div className="sdm-block">
            <span className="sdm-label">Время</span>
            <span className="sdm-value">
              {formatTime(shift.start_time)}
              {shift.end_time ? ` – ${formatTime(shift.end_time)}` : ' – идёт'} ·{' '}
              {formatDuration(shift.duration)}
            </span>
          </div>

          <div className="sdm-row-2">
            <div className="sdm-block">
              <span className="sdm-label">Чаевые</span>
              <span className="sdm-value">
                {formatMoney(shift.total_tips, shift.currency)}
              </span>
            </div>
            <div className="sdm-block">
              <span className="sdm-label">Касса</span>
              <span className="sdm-value">
                {formatMoney(shift.total_cash_register, shift.currency)}
              </span>
            </div>
          </div>

          <div className="sdm-block">
            <span className="sdm-label">Заказов</span>
            <span className="sdm-value">{shift.order_count}</span>
          </div>

          {shift.is_closed && (
            <div className="sdm-actions">
              <button
                className="btn btn--ghost-danger sdm-delete"
                disabled={busy}
                onClick={onDelete}
              >
                Удалить смену
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}