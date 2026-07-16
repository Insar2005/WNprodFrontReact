import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useHallStore } from '@/stores/hall'
import { useOrderStore } from '@/stores/order'
import { useUiStore } from '@/stores/ui'
import { useNow } from '@/hooks/useNow'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import OrderDetailsSheet from '@/views/order/OrderDetailsSheet'
import {
  PencilIcon,
  PlusIcon,
  MinusIcon,
  FitIcon,
  CheckIcon,
} from '@/components/menu/menuIcons'
import '@/styles/map-editor.css'

/**
 * Карта — 1:1 MpScreen из прототипа waiter-note-map-editor
 * (map-redesign/map-screen.jsx).
 *
 *   • Шапка: «Карта» + пилюля заведения под заголовком, справа карандаш →
 *     редактор. Табы залов — пилюли. Строка-сводка «Занято X из Y ·
 *     на столах N ₽» / «Все столы свободны».
 *   • Канвас: dot-grid, привязанный к системе координат (двигается и
 *     масштабируется со столами); pan с порогом 6px; зум ×1.25/÷0.8,
 *     clamp [fit·0.6 … 2.5]; ⌖ вписывает зал. transition на transform
 *     отключается на время pan.
 *   • Стол: свободный recessed / занятый accent-fill с суммой; таймер
 *     «N м» (тик 30 с), >30 мин — warn + точка; бейдж-галка «всё подано»;
 *     mp-pulse при ?highlight_table. rotation нормализуется — контент
 *     не вращается.
 *   • Смена закрыта: слой столов приглушён, warn-плашка, тап — тост.
 *   • Тапы: занятый → карточка заказа; свободный → сборка с ?table_id.
 *
 * Unchanged (do not regress): query-эффекты ?highlight_table / ?show_order
 * (переключают зал, чистят query), guard закрытой смены, поиск заказа
 * стола (orderByTable + fallback table.order_id), OrderDetailsSheet.
 */

/* видимый bbox стола с произвольным поворотом вокруг центра */
const visBox = (t) => {
  const r = ((t.rotation || 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const bw = t.width * c + t.height * s
  const bh = t.width * s + t.height * c
  return { x: t.x + (t.width - bw) / 2, y: t.y + (t.height - bh) / 2, w: bw, h: bh }
}
const tablesBBox = (tables) => {
  let x0 = 1e9
  let y0 = 1e9
  let x1 = -1e9
  let y1 = -1e9
  for (const t of tables) {
    const v = visBox(t)
    x0 = Math.min(x0, v.x)
    y0 = Math.min(y0, v.y)
    x1 = Math.max(x1, v.x + v.w)
    y1 = Math.max(y1, v.y + v.h)
  }
  if (x0 > x1) return { x: 0, y: 0, w: 100, h: 100 }
  return { x: x0 - 20, y: y0 - 20, w: x1 - x0 + 40, h: y1 - y0 + 40 }
}
const shortMoney = (n) => `${Math.round(n || 0).toLocaleString('ru-RU')} ₽`

/* ── Стол ── */
function MpTable({ t, order, nowMs, pulse, onTap }) {
  const occ = !!order
  const mins = occ
    ? Math.max(0, Math.floor((nowMs / 1000 - Number(order.created_at)) / 60))
    : 0
  const long = occ && mins > 30
  const items = order?.items || []
  const all = occ && items.length > 0 && items.every((i) => i.served)
  const cls = [
    'mp-table',
    occ ? 'mp-table--occ' : '',
    pulse ? 'mp-table--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      role="button"
      onClick={onTap}
      style={{
        left: t.x,
        top: t.y,
        width: t.width,
        height: t.height,
        borderRadius: t.border_radius,
        transform: `rotate(${t.rotation || 0}deg)`,
      }}
    >
      <div
        className="mp-table-inner"
        style={{ transform: `rotate(${-(t.rotation || 0)}deg)` }}
      >
        <div className="mp-table-center">
          <span className="mp-table-num">№{t.number}</span>
          {occ && <span className="mp-table-sum">{shortMoney(order.total_price)}</span>}
        </div>
        {occ && (
          <span className="mp-table-timer">
            {long && <span className="mp-table-timer-dot" aria-hidden />}
            <span className={`mp-table-timer-text${long ? ' mp-table-timer-text--warn' : ''}`}>
              {mins} м
            </span>
          </span>
        )}
        {all && (
          <span className="mp-table-served" aria-label="Всё подано">
            <CheckIcon width={9} height={9} strokeWidth={3.2} />
          </span>
        )}
      </div>
    </div>
  )
}

/* ── Канвас: pan/zoom, fit ── */
function MpCanvas({ hall, tables, findOrder, shiftOpen, nowMs, pulseTableId, onTable }) {
  const wrapRef = useRef(null)
  const fitScaleRef = useRef(1)
  const movedRef = useRef(false)
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState(null)

  const bbox = useMemo(() => tablesBBox(tables), [tables])

  const fit = () => {
    const el = wrapRef.current
    if (!el) return
    const cw = el.clientWidth
    const ch = el.clientHeight
    const s = Math.min(cw / bbox.w, ch / bbox.h)
    fitScaleRef.current = s
    setView({
      s,
      tx: (cw - bbox.w * s) / 2 - bbox.x * s,
      ty: (ch - bbox.h * s) / 2 - bbox.y * s,
    })
  }
  // Вписываем зал при смене зала/набора столов (первый рендер включительно).
  useEffect(fit, [hall.id, bbox.x, bbox.y, bbox.w, bbox.h])

  const zoom = (f) =>
    setView((v) => {
      const el = wrapRef.current
      if (!v || !el) return v
      const s2 = Math.min(2.5, Math.max(fitScaleRef.current * 0.6, v.s * f))
      const k = s2 / v.s
      const cx = el.clientWidth / 2
      const cy = el.clientHeight / 2
      return { s: s2, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })

  const down = (e) => {
    if (!view) return
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
    movedRef.current = false
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true
    if (movedRef.current) setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
  }
  const up = () => {
    dragRef.current = null
    setDragging(false)
  }

  const layerCls = [
    'mp-layer',
    dragging ? 'mp-layer--nt' : '',
    shiftOpen ? '' : 'mp-layer--dim',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={wrapRef}
      className={`mp-canvas${dragging ? ' mp-canvas--dragging' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        backgroundSize: view ? `${16 * view.s}px ${16 * view.s}px` : '16px 16px',
        backgroundPosition: view ? `${view.tx}px ${view.ty}px` : '0 0',
      }}
    >
      {view && (
        <div
          className={layerCls}
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}
        >
          {tables.map((t) => {
            const order = findOrder(t)
            const pulse = pulseTableId === t.id
            return (
              <MpTable
                key={`${t.id}${pulse ? '-p' : ''}`}
                t={t}
                order={order}
                nowMs={nowMs}
                pulse={pulse}
                onTap={() => {
                  if (!movedRef.current) onTable(t, order)
                }}
              />
            )
          })}
        </div>
      )}

      {!shiftOpen && (
        <div className="mp-locked">Смена не открыта — карта в режиме просмотра</div>
      )}

      <div className="mp-zoom">
        <button
          type="button"
          className="mp-zoom-btn"
          aria-label="Приблизить"
          onClick={(e) => {
            e.stopPropagation()
            zoom(1.25)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <PlusIcon width={17} height={17} />
        </button>
        <button
          type="button"
          className="mp-zoom-btn"
          aria-label="Отдалить"
          onClick={(e) => {
            e.stopPropagation()
            zoom(0.8)
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MinusIcon width={17} height={17} />
        </button>
        <button
          type="button"
          className="mp-zoom-btn"
          aria-label="Вписать зал"
          onClick={(e) => {
            e.stopPropagation()
            fit()
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <FitIcon width={17} height={17} />
        </button>
      </div>
    </div>
  )
}

export default function MapView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentId = useWorkplaceStore((s) => s.currentId)
  const isShiftOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)

  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)
  const activeHallId = useHallStore((s) => s.activeHallId)
  const orders = useOrderStore((s) => s.orders)

  const pulseTimer = useRef(null)
  const [highlightTableId, setHighlightTableId] = useState(null)
  const [detailsOrder, setDetailsOrder] = useState(null)

  const now = useNow(30_000)
  const nowMs = now.getTime()

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

  // Заказ стола: по связи из стора, с fallback на table.order_id.
  const findOrder = (table) => {
    const orderStore = useOrderStore.getState()
    let o = orderStore.orderByTable(table.id)
    if (!o && table.order_id) {
      const candidate = orderStore.orderById(table.order_id)
      if (candidate && !candidate.is_paid) o = candidate
    }
    return o || null
  }

  const occupiedOrders = useMemo(() => {
    void orders // пересчёт при изменениях заказов
    return tablesOfActive.map((t) => findOrder(t)).filter(Boolean)
  }, [tablesOfActive, orders])

  // Query-driven effects: highlight a table or auto-open an order's sheet.
  // Навигационное событие → читаем сторы → чистим query; setState здесь —
  // намеренный паттерн «внешняя система → React».
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
      }
      needClear = true
    }

    if (needClear) {
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  /* eslint-enable react-hooks/set-state-in-effect */

  const onTable = (table, order) => {
    if (!isShiftOpen) {
      useUiStore.getState().toastInfo('Откройте смену, чтобы работать с заказами')
      return
    }
    if (order) {
      setDetailsOrder(order)
    } else {
      navigate(`/order-builder?table_id=${encodeURIComponent(table.id)}`)
    }
  }

  return (
    <div className="page mp-page">
      <header className="mp-header">
        <div className="mp-header-main">
          <h1 className="mp-title">Карта</h1>
          <WorkplaceSwitcher />
        </div>
        <button
          type="button"
          className="mp-edit-btn"
          aria-label="Редактор карты"
          onClick={() => navigate('/hall-editor')}
        >
          <PencilIcon width={18} height={18} />
        </button>
      </header>

      {!currentId ? (
        <div className="mp-nohalls-wrap">
          <div className="mp-nohalls">
            <div className="mp-nohalls-title">Выберите заведение</div>
            <div className="mp-nohalls-text">Заведение выбирается в Профиле</div>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="mp-nohalls-wrap">
          <div className="mp-nohalls">
            <div className="mp-nohalls-title">Залов пока нет</div>
            <div className="mp-nohalls-text">
              Создайте зал и расставьте столы в редакторе
            </div>
            <button
              type="button"
              className="mp-nohalls-btn"
              onClick={() => navigate('/hall-editor')}
            >
              Открыть редактор
            </button>
          </div>
        </div>
      ) : (
        <>
          {sortedHalls.length > 1 && (
            <div className="mp-tabs">
              {sortedHalls.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`mp-tab${h.id === activeHallId ? ' mp-tab--on' : ''}`}
                  onClick={() => useHallStore.getState().setActiveHall(h.id)}
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}

          <div className="mp-summary">
            {occupiedOrders.length > 0 ? (
              <>
                Занято {occupiedOrders.length} из {tablesOfActive.length} · на столах{' '}
                {shortMoney(occupiedOrders.reduce((a, o) => a + (o.total_price || 0), 0))}
              </>
            ) : (
              'Все столы свободны'
            )}
          </div>

          {activeHall && (
            <MpCanvas
              hall={activeHall}
              tables={tablesOfActive}
              findOrder={findOrder}
              shiftOpen={isShiftOpen}
              nowMs={nowMs}
              pulseTableId={highlightTableId}
              onTable={onTable}
            />
          )}
          <div className="mp-canvas-spacer" aria-hidden />
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
