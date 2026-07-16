import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useShiftStore } from '@/stores/shift'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { ordersApi } from '@/api/orders'
import { formatMoney } from '@/utils/format'
import { dayLabel } from '@/utils/shiftFormat'
import { pluralize } from '@/utils/pluralize'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'
import ShiftOrderRow from '@/views/shifts/ShiftOrderRow'
import ShiftReportSheet from '@/views/shifts/ShiftReportSheet'
import OrderDetailsSheet from './OrderDetailsSheet'
import '@/styles/order-sheet.css'
import '@/styles/home-shifts.css'

/**
 * История заказов — 1:1 OhHistoryScreen из прототипа waiter-note-unified
 * (orders-history-redesign/history-screen.jsx): лента заказов,
 * сгруппированная по сменам.
 *
 *   • Группа = смена. Текущая: «Сегодня · смена идёт · N заказов»
 *     (неоплаченные — с бейджем, как в отчёте). Закрытые: «12 июля, сб ·
 *     14 заказов · 32 100,00 ₽» — заказы группы подгружаются запросом
 *     GET /shifts/{id}/orders при появлении группы на экране.
 *   • «Отчёт ›» в лейбле группы открывает отчёт этой смены.
 *   • Тап по заказу: активный → карточка заказа; оплаченный текущей
 *     смены → чек с «Изменить»/«Вернуть в активные»; заказ закрытой
 *     смены → чистый чек.
 *   • «Показать ещё» добавляет группы (и догружает историю смен).
 */

const GROUPS_PAGE = 5

/* Группа закрытой смены: лениво тянет свои заказы. */
function ClosedGroup({ shift, currency, onOpenReport, onOrderTap }) {
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    let alive = true
    ordersApi
      .listForShift(shift.id, { onlyPaid: true })
      .then((list) => {
        if (alive) setOrders([...list].sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0)))
      })
      .catch(() => {
        if (alive) setOrders([])
      })
    return () => {
      alive = false
    }
  }, [shift.id])

  const label = `${dayLabel(shift.start_time)} · ${shift.order_count} ${pluralize(shift.order_count, ['заказ', 'заказа', 'заказов'])} · ${formatMoney(shift.total_cash_register, currency)}`

  return (
    <div className="ohs-group">
      <div className="ohs-group-head">
        <span className="ohs-group-label">{label}</span>
        <button type="button" className="ohs-report-link" onClick={onOpenReport}>
          Отчёт ›
        </button>
      </div>
      <div className="ohs-group-card">
        {orders == null ? (
          <div className="ohs-group-loading">
            <div className="shh-spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="ohs-group-empty">Заказов пока нет</div>
        ) : (
          orders.map((o, i) => (
            <div key={o.id || i} className="rep-order-wrap">
              <ShiftOrderRow order={o} currency={currency} onTap={() => onOrderTap(o, shift)} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function OrderHistoryView() {
  const navigate = useNavigate()

  const orders = useOrderStore((s) => s.orders)
  const current = useShiftStore((s) => s.current)
  const history = useShiftStore((s) => s.history)
  const historyHasMore = useShiftStore((s) => s.historyHasMore)
  const isLoadingHistory = useShiftStore((s) => s.isLoadingHistory)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const workplace = useWorkplaceStore((s) => s.current())
  const currency = workplace?.currency ?? 'RUB'

  const [visibleGroups, setVisibleGroups] = useState(GROUPS_PAGE)
  const [details, setDetails] = useState(null) // {order, mode:'active'|'paid'|'check'}
  const [report, setReport] = useState(null) // {kind:'current'} | {kind:'closed', shift}

  // История смен нужна для групп — догружаем, если пусто.
  useEffect(() => {
    const s = useShiftStore.getState()
    if (currentId && s.history.length === 0 && s.historyHasMore) {
      s.fetchHistory(currentId).catch(() => {})
    }
  }, [currentId])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/home')
  }
  useTelegramBackButton(goBack)

  // Текущая смена: неоплаченные сверху с бейджем, затем оплаченные.
  const currentRows = useMemo(() => {
    const unpaid = orders
      .filter((o) => !o.is_paid)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
    const paid = orders
      .filter((o) => o.is_paid)
      .sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0))
    return [...unpaid, ...paid]
  }, [orders])

  const shownShifts = history.slice(0, visibleGroups)
  const moreAvailable = history.length > visibleGroups || historyHasMore

  const loadMore = async () => {
    const next = visibleGroups + GROUPS_PAGE
    if (next > history.length && historyHasMore && currentId && !isLoadingHistory) {
      try {
        await useShiftStore.getState().fetchHistory(currentId)
      } catch (e) {
        useUiStore.getState().toastError(e.message)
      }
    }
    setVisibleGroups(next)
  }

  /* ── тапы по заказам ── */
  const onCurrentOrderTap = (o) => {
    setDetails({ order: o, mode: o.is_paid ? 'paid' : 'active' })
  }
  const onClosedOrderTap = (o) => setDetails({ order: o, mode: 'check' })

  const onReopen = async (o) => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Вернуть заказ в активные?',
      message: 'Заказ снова станет активным, стол будет занят. Касса смены пересчитается.',
      confirmText: 'Вернуть',
    })
    if (!ok) return
    try {
      await useOrderStore.getState().reopenOrder(o.id)
      ui.toastSuccess('Заказ возвращён в активные')
      setDetails(null)
      if (o.table_id) navigate(`/map?show_order=${encodeURIComponent(o.id)}`)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  const onEdit = (o) => {
    setDetails(null)
    navigate(`/order-builder?edit_paid=${encodeURIComponent(o.id)}`)
  }

  const currentLabel = current
    ? `Сегодня · смена идёт · ${currentRows.length} ${pluralize(currentRows.length, ['заказ', 'заказа', 'заказов'])}`
    : null

  return (
    <div className="page ohs-page">
      <header className="ohs-header">
        
        <div className="ohs-head-main">
          <h1 className="ohs-title">История заказов</h1>
          {workplace?.title && <div className="ohs-venue">{workplace.title}</div>}
        </div>
      </header>

      <div className="ohs-body">
        {current && (
          <div className="ohs-group">
            <div className="ohs-group-head">
              <span className="ohs-group-label">{currentLabel}</span>
              <button
                type="button"
                className="ohs-report-link"
                onClick={() => setReport({ kind: 'current' })}
              >
                Отчёт ›
              </button>
            </div>
            <div className="ohs-group-card">
              {currentRows.length === 0 ? (
                <div className="ohs-group-empty">Заказов пока нет</div>
              ) : (
                currentRows.map((o, i) => (
                  <div key={o.id || i} className="rep-order-wrap">
                    <ShiftOrderRow
                      order={o}
                      currency={currency}
                      onTap={() => onCurrentOrderTap(o)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {shownShifts.map((s) => (
          <ClosedGroup
            key={s.id}
            shift={s}
            currency={s.currency || currency}
            onOpenReport={() => setReport({ kind: 'closed', shift: s })}
            onOrderTap={onClosedOrderTap}
          />
        ))}

        {!current && history.length === 0 && !isLoadingHistory && (
          <div className="shh-empty">Заказов пока нет</div>
        )}

        {isLoadingHistory && (
          <div className="shh-loading">
            <div className="shh-spinner" />
          </div>
        )}

        {moreAvailable && !isLoadingHistory && (
          <button type="button" className="ohs-more" onClick={loadMore}>
            Показать ещё
          </button>
        )}
      </div>

      {details && (
        <OrderDetailsSheet
          key={details.order.id}
          visible
          order={details.order}
          paidMode={details.mode !== 'active'}
          onClose={() => setDetails(null)}
          onReopen={details.mode === 'paid' ? onReopen : undefined}
          onEdit={details.mode === 'paid' ? onEdit : undefined}
        />
      )}

      {report && (
        <ShiftReportSheet
          shift={report.kind === 'current' ? current : report.shift}
          isCurrent={report.kind === 'current'}
          onClose={() => setReport(null)}
          onDeleted={() => setReport(null)}
          onOrderTap={(o) =>
            report.kind === 'current' ? onCurrentOrderTap(o) : onClosedOrderTap(o)
          }
        />
      )}
    </div>
  )
}
