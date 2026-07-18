import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { useLiveDuration } from '@/hooks/useLiveDuration'
import { newId } from '@/utils/nanoid'
import { formatMoney, formatTime } from '@/utils/format'
import { MONTHS_UP, dateParts, dayLabel, fmtTimer, fmtDur } from '@/utils/shiftFormat'
import { pluralize } from '@/utils/pluralize'
import { ChevronRight } from '@/components/menu/menuIcons'
import ShiftReportSheet from './ShiftReportSheet'
import OrderDetailsSheet from '@/views/order/OrderDetailsSheet'
import '@/styles/home-shifts.css'

/**
 * Смены — 1:1 по прототипу waiter-note-unified (shifts-redesign/).
 *
 *   • Hero идущей смены: пульс-точка + «Смена идёт» + пилюля «Закрыть»;
 *     живой таймер 32/700 + «Начало в HH:MM»; сетка 2×2 (Заработано
 *     accent + подпись условий, Чаевые, Касса, Заказов); мета «Средний
 *     чек · N заказа/час»; warn-плашка «K заказов ещё не оплачены» →
 *     Главная. Тап по карточке → отчёт текущей смены.
 *   • Смена закрыта: карточка открытия со снапшотом реальных условий
 *     заведения и кнопкой «Открыть смену».
 *   • История: группы по месяцам с итогом в лейбле («ИЮЛЬ · 6 смен ·
 *     41 300,00 ₽»), ряды «дата / время–время · длительность · N заказов
 *     / заработок + чаевые», «Показать ещё». Тап по ряду → отчёт.
 *   • Отчёт (ShiftReportSheet) заменил прежний ShiftDetailsModal.
 *
 * Флоу закрытия: при активных заказах — confirm «Есть заказы на столах…
 * Оплатить все и закрыть» (force); иначе — confirm «Закрыть смену?».
 * 409-fallback от бэка сохранён на случай гонки.
 */

/* ── A. Hero идущей смены ── */
function HeroCard({ shift, unpaidCount, closing, onOpenReport, onRequestClose, onUnpaidTap }) {
  const elapsed = useLiveDuration(() => shift?.start_time)
  const count = shift.order_count || 0
  const cash = shift.total_cash_register || 0
  const perHour =
    count > 0 && elapsed > 0 ? (count / (elapsed / 3600)).toFixed(1).replace('.', ',') : null
  const condSub =
    shift.shift_type === 'percent' ? `${shift.service_percent}% от кассы` : 'фикс. ставка'

  return (
    <div className="shc-card" onClick={onOpenReport}>
      <div className="shc-status">
        <span className="shc-dot" aria-hidden />
        <span className="shc-status-text">Смена идёт</span>
        <button
          type="button"
          className="shc-close"
          disabled={closing}
          onClick={(e) => {
            e.stopPropagation()
            onRequestClose()
          }}
        >
          Закрыть
        </button>
      </div>

      <div className="shc-timer">{fmtTimer(elapsed)}</div>
      <div className="shc-started">Начало в {formatTime(shift.start_time)}</div>
      <div className="shc-divider" aria-hidden />

      <div className="shc-stats">
        <div className="shc-stat">
          <span className="shc-stat-label">Заработано</span>
          <span className="shc-stat-value shc-stat-value--accent">
            {formatMoney(shift.total_pay_for_shift || 0, shift.currency)}
          </span>
          <span className="shc-stat-sub">{condSub}</span>
        </div>
        <div className="shc-stat">
          <span className="shc-stat-label">Чаевые</span>
          <span className="shc-stat-value">
            {formatMoney(shift.total_tips || 0, shift.currency)}
          </span>
        </div>
        <div className="shc-stat">
          <span className="shc-stat-label">Касса</span>
          <span className="shc-stat-value">{formatMoney(cash, shift.currency)}</span>
        </div>
        <div className="shc-stat">
          <span className="shc-stat-label">Заказов</span>
          <span className="shc-stat-value">{count}</span>
        </div>
      </div>

      {count > 0 && (
        <div className="shc-meta">
          Средний чек {formatMoney(Math.round(cash / count), shift.currency)}
          {perHour && <> · {perHour} заказа/час</>}
        </div>
      )}

      {unpaidCount > 0 && (
        <button
          type="button"
          className="shc-unpaid"
          onClick={(e) => {
            e.stopPropagation()
            onUnpaidTap()
          }}
        >
          <span className="shc-unpaid-text">
            {unpaidCount}{' '}
            {pluralize(unpaidCount, [
              'заказ ещё не оплачен',
              'заказа ещё не оплачены',
              'заказов ещё не оплачены',
            ])}
          </span>
          <span className="shc-unpaid-chev" aria-hidden>
            <ChevronRight width={16} height={16} />
          </span>
        </button>
      )}
    </div>
  )
}

/* ── B. Карточка открытия (снапшот реальных условий заведения) ── */
function OpenCard({ workplace, opening, onOpen }) {
  const type = workplace?.shift_type_default ?? 'fixed'
  const percent = workplace?.service_percent_default ?? 0
  const pay = workplace?.pay_for_shift_default ?? 0
  const currency = workplace?.currency ?? 'RUB'
  const rows =
    type === 'percent'
      ? [
          ['Тип оплаты', 'Процент'],
          ['Процент', `${percent} %`],
        ]
      : [
          ['Тип оплаты', 'Фикс'],
          ['Ставка', formatMoney(pay, currency)],
        ]

  return (
    <div className="soc-card">
      <div className="soc-title">Смена не открыта</div>
      <div className="soc-sub">Откройте смену, чтобы принимать заказы</div>
      <div className="soc-snapshot">
        {rows.map(([l, v]) => (
          <div key={l} className="soc-row">
            <span className="soc-row-label">{l}</span>
            <span className="soc-row-value">{v}</span>
          </div>
        ))}
      </div>
      <div className="soc-hint">Условия фиксируются в момент открытия</div>
      <button type="button" className="soc-open" disabled={opening} onClick={onOpen}>
        {opening ? 'Открываем…' : 'Открыть смену'}
      </button>
    </div>
  )
}

export default function Shifts() {
  const navigate = useNavigate()

  const current = useShiftStore((s) => s.current)
  const history = useShiftStore((s) => s.history)
  const historyHasMore = useShiftStore((s) => s.historyHasMore)
  const isLoadingHistory = useShiftStore((s) => s.isLoadingHistory)
  const orders = useOrderStore((s) => s.orders)

  const currentId = useWorkplaceStore((s) => s.currentId)
  const workplace = useWorkplaceStore((s) => s.current())

  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [report, setReport] = useState(null) // {kind:'current'} | {kind:'closed', shift}
  const [details, setDetails] = useState(null) // {order, mode:'active'|'paid'|'check'}

  const unpaidCount = useMemo(
    () => orders.filter((o) => !o.is_paid).length,
    [orders],
  )

  // История подгружается при смене заведения (App); если пришли первыми —
  // догружаем сами.
  useEffect(() => {
    const s = useShiftStore.getState()
    if (currentId && s.history.length === 0 && s.historyHasMore) {
      s.fetchHistory(currentId).catch((e) =>
        useUiStore.getState().toastError(e.message),
      )
    }
  }, [currentId])

  // Группировка истории по месяцам, лейбл — итог по загруженным.
  const monthGroups = useMemo(() => {
    const groups = []
    for (const s of history) {
      const { year, month } = dateParts(s.start_time)
      const key = `${year}-${month}`
      let g = groups[groups.length - 1]
      if (!g || g.key !== key) {
        g = { key, month: MONTHS_UP[month], shifts: [] }
        groups.push(g)
      }
      g.shifts.push(s)
    }
    return groups
  }, [history])

  const onOpenShift = async () => {
    if (!currentId) return
    setOpening(true)
    try {
      await useShiftStore.getState().open(currentId, { id: newId() })
      useUiStore.getState().toastSuccess('Смена открыта')
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setOpening(false)
    }
  }

  // Карта после закрытия всё ещё считает столы занятыми — обновляем.
  const syncMapAfterShiftClose = async () => {
    if (!currentId) return
    try {
      await useHallStore.getState().fetchAll(currentId)
    } catch {
      /* карта синхронизируется при следующем визите */
    }
  }

  const doClose = async (force) => {
    const shift = useShiftStore.getState()
    const ui = useUiStore.getState()
    const cur = shift.current
    if (!cur) return
    setClosing(true)
    try {
      await shift.close(cur.id, { force })
      await syncMapAfterShiftClose()
      if (report?.kind === 'current') setReport(null)
      ui.toastSuccess(
        force && unpaidCount > 0 ? `Оплачено ${unpaidCount}, смена закрыта` : 'Смена закрыта',
      )
    } catch (e) {
      // Гонка: за время confirm'а появился неоплаченный заказ.
      if (e.status === 409 && !force) {
        const ok = await ui.confirm({
          title: 'Есть заказы на столах',
          message: 'Появились неоплаченные заказы. Закрыть смену и оплатить их без чаевых?',
          confirmText: 'Оплатить все и закрыть',
          cancelText: 'Отмена',
          danger: true,
        })
        if (ok) {
          try {
            await shift.close(cur.id, { force: true })
            await syncMapAfterShiftClose()
            if (report?.kind === 'current') setReport(null)
            ui.toastSuccess('Смена закрыта')
          } catch (e2) {
            ui.toastError(e2.message)
          }
        }
      } else {
        ui.toastError(e.message)
      }
    } finally {
      setClosing(false)
    }
  }

  // Прототип: подтверждение всегда; текст зависит от активных заказов.
  const onRequestClose = async () => {
    const ui = useUiStore.getState()
    if (unpaidCount > 0) {
      const ok = await ui.confirm({
        title: 'Есть заказы на столах',
        message: `Сейчас ${unpaidCount} ${pluralize(unpaidCount, ['активный заказ', 'активных заказа', 'активных заказов'])}. Закрыть смену и оплатить их без чаевых?`,
        confirmText: 'Оплатить все и закрыть',
        cancelText: 'Отмена',
        danger: true,
      })
      if (ok) await doClose(true)
    } else {
      const ok = await ui.confirm({
        title: 'Закрыть смену?',
        message: 'Итоги и заказы сохранятся в истории.',
        confirmText: 'Закрыть',
        cancelText: 'Отмена',
        danger: true,
      })
      if (ok) await doClose(false)
    }
  }

  const loadMore = async () => {
    if (!currentId) return
    try {
      await useShiftStore.getState().fetchHistory(currentId)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  // Тап по заказу в отчёте: активный → карточка; оплаченный текущей смены →
  // чек с «Изменить»/«Вернуть»; заказ закрытой смены → чистый чек.
  const onReportOrderTap = (o) => {
    if (report?.kind === 'current') {
      setDetails({ order: o, mode: o.is_paid ? 'paid' : 'active' })
    } else {
      setDetails({ order: o, mode: 'check' })
    }
  }

  const onReopenOrder = async (o) => {
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
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  const onEditOrder = (o) => {
    setDetails(null)
    setReport(null)
    navigate(`/order-builder?edit_paid=${encodeURIComponent(o.id)}`)
  }

  const reportShift = report?.kind === 'current' ? current : report?.shift
  const monthTotal = (shifts) =>
    shifts.reduce((a, s) => a + (s.total_pay_for_shift || 0), 0)

  return (
    <div className="page shs-page">
      <header className="shs-header">
        <h1 className="shs-title">Смены</h1>
        {workplace?.title && <div className="shs-venue">{workplace.title}</div>}
      </header>

      {!currentId ? (
        <div className="shs-novenue">Выберите заведение в Профиле</div>
      ) : (
        <div className="shs-body">
          {current ? (
            <HeroCard
              shift={current}
              unpaidCount={unpaidCount}
              closing={closing}
              onOpenReport={() => setReport({ kind: 'current' })}
              onRequestClose={onRequestClose}
              onUnpaidTap={() => navigate('/home')}
            />
          ) : (
            <OpenCard workplace={workplace} opening={opening} onOpen={onOpenShift} />
          )}

          <div className="shh-wrap">
            <div className="shs-label">История смен</div>

            {history.length === 0 && !isLoadingHistory && (
              <div className="shh-empty">Закрытых смен пока нет</div>
            )}

            {monthGroups.map((g, gi) => (
              <div key={g.key} className={gi > 0 ? 'shh-group' : undefined}>
                <div className="shs-label shs-label--faint">
                  {g.month} · {g.shifts.length}{' '}
                  {pluralize(g.shifts.length, ['смена', 'смены', 'смен'])} ·{' '}
                  {formatMoney(monthTotal(g.shifts), g.shifts[0]?.currency)}
                </div>
                <div className="shh-list">
                  {g.shifts.map((s) => (
                    <button
  key={s.id}
  type="button"
  className="shh-row"
  onClick={() => setReport({ kind: 'closed', shift: s })}
>
  <div className="shh-main">
    <div className="shh-date">{dayLabel(s.start_time)}</div>
    <div className="shh-meta">
      {formatTime(s.start_time)} – {formatTime(s.end_time)} ·{' '}
      {fmtDur(s.duration)} · {s.order_count}{' '}
      {pluralize(s.order_count, ['заказ', 'заказа', 'заказов'])}
    </div>
  </div>
  <div className="shh-right">
    <div className="shh-earned">
      {formatMoney(s.total_pay_for_shift, s.currency)}
    </div>
    {s.total_tips > 0 && (
      <div className="shh-tips">
        + {formatMoney(s.total_tips, s.currency)} чаевые
      </div>
    )}
  </div>
</button>
                  ))}
                </div>
              </div>
            ))}

            {historyHasMore && !isLoadingHistory && history.length > 0 && (
              <button type="button" className="shh-more" onClick={loadMore}>
                Показать ещё
              </button>
            )}
            {isLoadingHistory && (
              <div className="shh-loading">
                <div className="shh-spinner" />
              </div>
            )}
          </div>
        </div>
      )}

      {reportShift && (
        <ShiftReportSheet
          shift={reportShift}
          isCurrent={report?.kind === 'current'}
          onClose={() => setReport(null)}
          onDeleted={() => setReport(null)}
          onOrderTap={onReportOrderTap}
        />
      )}

      {details && (
        <OrderDetailsSheet
          key={details.order.id}
          visible
          order={details.order}
          paidMode={details.mode !== 'active'}
          onClose={() => setDetails(null)}
          onReopen={details.mode === 'paid' ? onReopenOrder : undefined}
          onEdit={details.mode === 'paid' ? onEditOrder : undefined}
        />
      )}
    </div>
  )
}
