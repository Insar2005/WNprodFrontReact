import { useNow } from '@/hooks/useNow'
import { formatMoney, formatDuration } from '@/utils/format'

/**
 * Active orders list. (Was ActiveOrdersList.vue.)
 * - @vueuse/core useNow → our useNow hook (one 30s clock for all rows).
 * - props.orders/currency → component props.
 * - $emit('open', o) → onOpen(o) callback prop.
 */

function itemCount(o) {
  return (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
}

function servedCount(o) {
  return (o.items || [])
    .filter((i) => i.served)
    .reduce((s, i) => s + (i.quantity || 0), 0)
}

function allServed(o) {
  const total = itemCount(o)
  return total > 0 && servedCount(o) === total
}

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export default function ActiveOrdersList({ orders, currency = 'RUB', onOpen }) {
  const now = useNow(30_000)

  const durationFor = (o) => {
    if (!o?.created_at) return 0
    return Math.max(0, Math.floor(now.getTime() / 1000) - Number(o.created_at))
  }

  if (orders.length === 0) {
    return (
      <div className="aol-empty">
        <span className="aol-empty-icon">✓</span>
        <span className="aol-empty-text">Все столы свободны</span>
      </div>
    )
  }

  return (
    <div className="aol-list">
      {orders.map((o) => (
        <button key={o.id} className="aol-row" onClick={() => onOpen?.(o)}>
          <div className="aol-table">
            <span className="aol-table-label">№</span>
            <span className="aol-table-num">{o.table_number || '—'}</span>
          </div>

          <div className="aol-main">
            <div className="aol-title">
              {o.table_number ? (
                <>
                  Стол №{o.table_number}
                  {o.hall_name ? ` · ${o.hall_name}` : ''}
                </>
              ) : (
                'Без стола'
              )}
            </div>
            <div className="aol-meta">
              <span className="aol-time">⏱ {formatDuration(durationFor(o))}</span>
              <span className="aol-dot">·</span>
              <span
                className={
                  allServed(o) ? 'aol-items aol-items--all-served' : 'aol-items'
                }
              >
                {servedCount(o) > 0
                  ? `${servedCount(o)}/${itemCount(o)} подано`
                  : `${itemCount(o)} ${pluralize(itemCount(o), [
                      'позиция',
                      'позиции',
                      'позиций',
                    ])}`}
              </span>
            </div>
            {o.comments && <div className="aol-comment">💬 {o.comments}</div>}
          </div>

          <div className="aol-amount">{formatMoney(o.total_price, currency)}</div>
        </button>
      ))}
    </div>
  )
}