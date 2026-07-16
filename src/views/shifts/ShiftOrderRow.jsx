import { formatMoney, formatTime } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'

/**
 * Ряд заказа — 1:1 WnOrderRow из прототипа (shifts-report.jsx). Общий для
 * отчёта по смене и истории заказов: время · Стол №N/Без стола
 * [· бейдж «не оплачен»] · K позиций · сумма accent [· чип «+чаевые»].
 * Классы rep-order-* (home-shifts.css).
 */
export default function ShiftOrderRow({ order, currency = 'RUB', onTap }) {
  const pos = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
  const unpaid = !order.is_paid

  const inner = (
    <>
      <span className="rep-order-time">
        {formatTime(unpaid ? order.created_at : order.closed_at)}
      </span>
      <span className="rep-order-main">
        <span className="rep-order-title">
          {order.table_number != null ? (
            <span className="rep-order-table">Стол №{order.table_number}</span>
          ) : (
            <span className="rep-order-table rep-order-table--none">Без стола</span>
          )}
          {unpaid && <span className="rep-order-unpaid">не оплачен</span>}
        </span>
        <span className="rep-order-meta">
          {pos} {pluralize(pos, ['позиция', 'позиции', 'позиций'])}
        </span>
      </span>
      <span className="rep-order-right">
        <span className="rep-order-sum">{formatMoney(order.total_price, currency)}</span>
        {order.tips > 0 && (
          <span className="rep-order-tips">+{Math.round(order.tips)} ₽</span>
        )}
      </span>
    </>
  )

  if (!onTap) return <div className="rep-order">{inner}</div>
  return (
    <button type="button" className="rep-order rep-order--tap" onClick={onTap}>
      {inner}
    </button>
  )
}
