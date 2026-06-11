import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useHallStore } from '@/stores/hall'
import { useOrderStore } from '@/stores/order'
import { useUiStore } from '@/stores/ui'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import HallSwitcher from './HallSwitcher'
import HallCanvas from './HallCanvas'
import OrderDetailsSheet from '@/views/order/OrderDetailsSheet'

/**
 * Hall map. (Was map.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - hall getters are methods → subscribe to raw halls/tables/activeHallId
 *   and derive sortedHalls/activeHall/tablesOfActive via useMemo (so the
 *   canvas re-renders when tables change, e.g. status updates).
 * - query side-effects (?show_order, ?highlight_table) → useEffect keyed on
 *   searchParams; nextTick → requestAnimationFrame; router.replace clears.
 * - canvasRef.centerOnTable via useRef + forwardRef on HallCanvas.
 * - OrderDetailsSheet keyed on order id so tips reset on change.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function MapView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')
  const isShiftOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)

  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)
  const activeHallId = useHallStore((s) => s.activeHallId)

  const canvasRef = useRef(null)
  const pulseTimer = useRef(null)
  const [highlightTableId, setHighlightTableId] = useState(null)
  const [detailsOrder, setDetailsOrder] = useState(null)

  const sortedHalls = useMemo(
    () => [...halls].sort((a, b) => a.position - b.position),
    [halls],
  )
  const activeHall = useMemo(
    () => halls.find((h) => h.id === activeHallId) ?? null,
    [halls, activeHallId],
  )
  const tablesOfActive = useMemo(
    () => tables.filter((t) => t.hall_id === activeHallId),
    [tables, activeHallId],
  )
  const isEmpty = halls.length === 0

  // Query-driven effects: highlight a table or auto-open an order's sheet.
  // This effect reacts to a navigation event (the URL query is the external
  // input), reads deferred data from the stores, then clears the query. The
  // setState calls here are the intended "sync external system → React"
  // pattern, so the set-state-in-effect rule is disabled for this block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const hallStore = useHallStore.getState()
    const orderStore = useOrderStore.getState()
    let needClear = false

    const tableId = searchParams.get('highlight_table')
    if (tableId) {
      const tableHallId = hallStore.tableById(tableId)?.hall_id
      if (tableHallId && tableHallId !== hallStore.activeHallId) {
        hallStore.setActiveHall(tableHallId)
      }
      setHighlightTableId(tableId)
      clearTimeout(pulseTimer.current)
      pulseTimer.current = setTimeout(() => setHighlightTableId(null), 2000)
      requestAnimationFrame(() => canvasRef.current?.centerOnTable(tableId))
      needClear = true
    }

    const orderId = searchParams.get('show_order')
    if (orderId) {
      const o = orderStore.orderById(orderId)
      if (o) {
        setDetailsOrder(o)
        const targetHallId =
          o.hall_id || (o.table_id ? hallStore.tableById(o.table_id)?.hall_id : null)
        if (targetHallId && targetHallId !== hallStore.activeHallId) {
          hallStore.setActiveHall(targetHallId)
        }
        if (o.table_id) {
          requestAnimationFrame(() => canvasRef.current?.centerOnTable(o.table_id))
        }
      }
      needClear = true
    }

    if (needClear) {
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  /* eslint-enable react-hooks/set-state-in-effect */

  const onTableClick = (table) => {
    const orderStore = useOrderStore.getState()
    if (!isShiftOpen) {
      useUiStore.getState().toastInfo('Откройте смену, чтобы работать с заказами')
      return
    }
    let existingOrder = orderStore.orderByTable(table.id)
    if (!existingOrder && table.order_id) {
      const candidate = orderStore.orderById(table.order_id)
      if (candidate && !candidate.is_paid) existingOrder = candidate
    }
    if (existingOrder) {
      setDetailsOrder(existingOrder)
      requestAnimationFrame(() => canvasRef.current?.centerOnTable(table.id))
    } else {
      navigate(`/order-builder?table_id=${encodeURIComponent(table.id)}`)
    }
  }

  return (
    <div className="map-page">
      <header className="map-header">
        <div className="map-header-left">
          <h1 className="map-title">Карта</h1>
          {currentTitle && <span className="map-subtitle">{currentTitle}</span>}
        </div>
        <WorkplaceSwitcher />
      </header>

      {currentId && !isShiftOpen && (
        <div className="map-banner">
          <span className="map-banner-icon">⏸</span>
          <span className="map-banner-text">
            Смена не открыта — приём заказов недоступен.
            <Link className="map-banner-link" to="/shifts">
              Открыть
            </Link>
          </span>
        </div>
      )}

      {!currentId ? (
        <div className="map-empty">
          <p>Выберите заведение в Профиле</p>
        </div>
      ) : isEmpty ? (
        <div className="map-empty">
          <p className="empty-title">В этом заведении ещё нет ни одного зала</p>
          <p className="empty-text">Добавьте зал в Профиле, чтобы расставить столы.</p>
          <button className="btn-primary" onClick={() => navigate('/hall-editor')}>
            Открыть редактор карты
          </button>
        </div>
      ) : (
        <>
          {sortedHalls.length > 1 && (
            <HallSwitcher
              halls={sortedHalls}
              activeId={activeHallId}
              onSelect={(id) => useHallStore.getState().setActiveHall(id)}
            />
          )}
          <div className="map-canvas-area">
            {activeHall && (
              <HallCanvas
                ref={canvasRef}
                hall={activeHall}
                tables={tablesOfActive}
                pulseTableId={highlightTableId}
                onTableClick={onTableClick}
              />
            )}
          </div>
        </>
      )}

      <OrderDetailsSheet
        key={detailsOrder?.id || 'none'}
        visible={!!detailsOrder}
        order={detailsOrder}
        onClose={() => setDetailsOrder(null)}
      />
    </div>
  )
}