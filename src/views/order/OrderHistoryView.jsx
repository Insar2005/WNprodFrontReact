import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useShiftStore } from '@/stores/shift'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney } from '@/utils/format'
import OrderDetailsSheet from './OrderDetailsSheet'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

function itemCount(o) {
  return (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
}
function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
function formatTimeOnly(ts) {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts * 1000))
}

/**
 * Order history (paid orders of the current shift). (Was OrderHistoryView.vue.)
 * - paidOrders/sortedPaid/totals → useMemo over raw orders.
 * - shift.isOpen → selector. detailsOrder → useState.
 * - reopen/edit go through OrderDetailsSheet (paid mode).
 */
export default function OrderHistoryView() {
  const navigate = useNavigate()

  const orders = useOrderStore((s) => s.orders)
  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const [detailsOrder, setDetailsOrder] = useState(null)

  const paidOrders = useMemo(() => orders.filter((o) => o.is_paid), [orders])
  const sortedPaid = useMemo(
    () => [...paidOrders].sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0)),
    [paidOrders],
  )
  const totalCash = useMemo(
    () => paidOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0),
    [paidOrders],
  )
  const totalTips = useMemo(
    () => paidOrders.reduce((s, o) => s + (Number(o.tips) || 0), 0),
    [paidOrders],
  )

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/home')
  }
  useTelegramBackButton(goBack)

  const onReopen = async (o) => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Вернуть заказ в активные?',
      message:
        'Заказ снова станет активным, стол будет занят. Касса смены пересчитается.',
      confirmText: 'Вернуть',
    })
    if (!ok) return
    try {
      await useOrderStore.getState().reopenOrder(o.id)
      ui.toastSuccess('Заказ возвращён в активные')
      setDetailsOrder(null)
      if (o.table_id) {
        navigate(`/map?show_order=${encodeURIComponent(o.id)}`)
      }
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  const onEdit = (o) => {
    setDetailsOrder(null)
    navigate(`/order-builder?edit_paid=${encodeURIComponent(o.id)}`)
  }

  return (
    <div className="page oh-page">
      <header className="oh-header">
        {/* <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button> */}
        <h1 className="oh-title">История заказов</h1>
      </header>

      {!isOpen ? (
        <div className="oh-empty">
          <p>Смена не открыта</p>
          <p className="oh-empty-sub">История доступна только во время текущей смены</p>
          <button className="btn-primary" onClick={() => navigate('/shifts')}>
            К сменам
          </button>
        </div>
      ) : paidOrders.length === 0 ? (
        <div className="oh-empty">
          <p>В этой смене ещё нет завершённых заказов</p>
          <p className="oh-empty-sub">Закрытые заказы появятся здесь</p>
        </div>
      ) : (
        <>
          <div className="oh-summary">
            <div className="oh-summary-row">
              <span className="oh-summary-label">Заказов</span>
              <span className="oh-summary-value">{paidOrders.length}</span>
            </div>
            <div className="oh-summary-row">
              <span className="oh-summary-label">Касса</span>
              <span className="oh-summary-value oh-summary-value--accent">
                {formatMoney(totalCash, currency)}
              </span>
            </div>
            {totalTips > 0 && (
              <div className="oh-summary-row">
                <span className="oh-summary-label">Чаевые</span>
                <span className="oh-summary-value">{formatMoney(totalTips, currency)}</span>
              </div>
            )}
          </div>

          <ul className="oh-list">
            {sortedPaid.map((o) => (
              <li key={o.id} className="oh-row" onClick={() => setDetailsOrder(o)}>
                <div className="oh-row-time">{formatTimeOnly(o.closed_at)}</div>
                <div className="oh-row-main">
                  <div className="oh-row-title">
                    {o.table_number ? `Стол №${o.table_number}` : 'Без стола'}
                    {o.hall_name && <span className="oh-row-hall"> · {o.hall_name}</span>}
                  </div>
                  <div className="oh-row-meta">
                    {itemCount(o)}{' '}
                    {pluralize(itemCount(o), ['позиция', 'позиции', 'позиций'])}
                    {o.tips > 0 && ` · чаевые ${formatMoney(o.tips, currency)}`}
                  </div>
                </div>
                <div className="oh-row-amount">
                  {formatMoney(o.total_price, currency)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <OrderDetailsSheet
        key={detailsOrder?.id || 'none'}
        visible={!!detailsOrder}
        order={detailsOrder}
        paidMode
        onClose={() => setDetailsOrder(null)}
        onReopen={onReopen}
        onEdit={onEdit}
      />
    </div>
  )
}