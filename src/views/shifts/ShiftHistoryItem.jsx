import { formatDate, formatTime, formatDuration, formatMoney } from '@/utils/format'

/**
 * One closed-shift history row. (Was ShiftHistoryItem.vue.)
 * $emit('open', shift) → onOpen(shift).
 */
export default function ShiftHistoryItem({ shift, onOpen }) {
  return (
    <div className="sh-row" onClick={() => onOpen?.(shift)}>
      <div className="sh-row-main">
        <div className="sh-row-date">{formatDate(shift.start_time)}</div>
        <div className="sh-row-meta">
          {formatTime(shift.start_time)} – {formatTime(shift.end_time)} ·{' '}
          {formatDuration(shift.duration)} · {shift.order_count} заказов
        </div>
      </div>
      <div className="sh-row-amount">
        <span className="sh-amount">
          {formatMoney(shift.total_pay_for_shift, shift.currency)}
        </span>
        {shift.total_tips > 0 && (
          <span className="sh-tips">
            + {formatMoney(shift.total_tips, shift.currency)} чаев.
          </span>
        )}
      </div>
    </div>
  )
}