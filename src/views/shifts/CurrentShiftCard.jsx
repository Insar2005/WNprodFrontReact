import { formatMoney, formatTime, formatDuration } from '@/utils/format'
import { useLiveDuration } from '@/hooks/useLiveDuration'

/**
 * Current open-shift card with live-ticking duration. (Was CurrentShiftCard.vue.)
 * - useLiveDuration composable → useLiveDuration hook.
 * - $emit('close-shift') → onClose().
 */
export default function CurrentShiftCard({ shift, closing = false, onClose }) {
  const seconds = useLiveDuration(() => shift?.start_time)
  const durationText = formatDuration(seconds)

  return (
    <div className="csc-card">
      <div className="csc-top">
        <div className="csc-dot" />
        <span className="csc-status">Смена идёт</span>
        <button className="csc-close" disabled={closing} onClick={() => onClose?.()}>
          Закрыть
        </button>
      </div>

      <div className="csc-duration">{durationText}</div>
      <div className="csc-started">Начало в {formatTime(shift.start_time)}</div>

      <div className="csc-stats">
        <div className="csc-stat">
          <span className="csc-stat-label">Заработано</span>
          <span className="csc-stat-value csc-stat-value--accent">
            {formatMoney(shift.total_pay_for_shift, shift.currency)}
          </span>
          <span className="csc-stat-sub">
            {shift.shift_type === 'percent'
              ? `${shift.service_percent}% от кассы`
              : 'фикс. ставка'}
          </span>
        </div>

        <div className="csc-stat">
          <span className="csc-stat-label">Чаевые</span>
          <span className="csc-stat-value">
            {formatMoney(shift.total_tips, shift.currency)}
          </span>
        </div>

        <div className="csc-stat">
          <span className="csc-stat-label">Касса</span>
          <span className="csc-stat-value">
            {formatMoney(shift.total_cash_register, shift.currency)}
          </span>
        </div>

        <div className="csc-stat">
          <span className="csc-stat-label">Заказов</span>
          <span className="csc-stat-value">{shift.order_count}</span>
        </div>
      </div>
    </div>
  )
}