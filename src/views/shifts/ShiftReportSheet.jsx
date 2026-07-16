import { useEffect, useMemo, useState } from 'react'
import { useOrderStore } from '@/stores/order'
import { useNow } from '@/hooks/useNow'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'
import { ordersApi } from '@/api/orders'
import { formatMoney, formatTime, formatDuration } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'
import { dayShort, hourOf } from '@/utils/shiftFormat'
import { ShareIcon } from '@/components/menu/menuIcons'
import WnSheet from '@/components/WnSheet'
import ShiftOrderRow from './ShiftOrderRow'
import '@/styles/home-shifts.css'

/**
 * Отчёт по смене — 1:1 WnReportSheet из прототипа waiter-note-unified
 * (shifts-redesign/shifts-report.jsx). Полноэкранный низ-шит:
 *
 *   Сводка (recessed-рядки: Заработано big-accent · Время · Касса ·
 *   Чаевые (+% от кассы) · Заказов · Средний чек) → «Выручка по часам»
 *   (бары простыми div, пустые часы — recessed) → «Топ позиций» →
 *   «Заказы · N» (время · стол · позиции · сумма · чип чаевых; в текущей
 *   смене неоплаченные — с warn-бейджем «не оплачен») → «Поделиться
 *   отчётом» (копирует текстовую сводку) → «Удалить смену» (только
 *   закрытые).
 *
 * Все цифры derived из заказов/агрегатов, ничего не выдумывается.
 * Заказы закрытой смены грузятся по requestу (GET /shifts/{id}/orders);
 * заказы текущей берутся из order store.
 *
 * Тап по заказу пока не подключён — карточка-чек (UoClosedSheet) едет
 * следующим этапом редизайна вместе с новой карточкой заказа.
 *
 * Props:
 *   shift     — объект смены (закрытая из истории или current из стора)
 *   isCurrent — true для идущей смены
 *   onClose, onDeleted — колбэки
 */

export default function ShiftReportSheet({ shift, isCurrent = false, onClose, onDeleted, onOrderTap }) {
  const storeOrders = useOrderStore((s) => s.orders)
  const [fetched, setFetched] = useState(null) // заказы закрытой смены
  const [loading, setLoading] = useState(!isCurrent)
  const [busy, setBusy] = useState(false)

  // Заказы закрытой смены — отдельным запросом (в сторе только текущая).
  useEffect(() => {
    if (isCurrent) return
    let alive = true
    ordersApi
      .listForShift(shift.id, { onlyPaid: true })
      .then((list) => { if (alive) setFetched(list) })
      .catch((e) => {
        if (alive) {
          setFetched([])
          useUiStore.getState().toastError(e.message || 'Не удалось загрузить заказы')
        }
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [isCurrent, shift.id])

  const now = useNow(30_000) // «идёт»: конец периода для длительности и баров
  const orders = useMemo(
    () => (isCurrent ? storeOrders : fetched || []),
    [isCurrent, storeOrders, fetched],
  )
  const paid = useMemo(
    () =>
      orders
        .filter((o) => o.is_paid)
        .sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0)),
    [orders],
  )
  const unpaid = useMemo(
    () =>
      isCurrent
        ? orders
            .filter((o) => !o.is_paid)
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
        : [],
    [orders, isCurrent],
  )
  const rows = useMemo(() => [...unpaid, ...paid], [unpaid, paid])

  const endSec = shift.end_time || Math.floor(now.getTime() / 1000)
  const cash = shift.total_cash_register || 0
  const tips = shift.total_tips || 0
  const count = shift.order_count || 0
  const tipsPct = cash > 0 ? ((tips / cash) * 100).toFixed(1).replace('.', ',') : null
  const condSub =
    shift.shift_type === 'percent' ? `${shift.service_percent}% от кассы` : 'фикс. ставка'
  const currency = shift.currency || 'RUB'

  // Гистограмма по часам — только оплаченные (это касса).
  const hourStats = useMemo(() => {
    const h0 = hourOf(shift.start_time)
    const h1 = hourOf(endSec)
    const hours = []
    for (let h = h0; h !== (h1 + 1) % 24; h = (h + 1) % 24) {
      hours.push({ h, v: 0 })
      if (hours.length > 24) break
    }
    for (const o of paid) {
      const b = hours.find((x) => x.h === hourOf(o.closed_at))
      if (b) b.v += o.total_price || 0
    }
    return hours
  }, [paid, shift.start_time, endSec])
  const maxHour = Math.max(1, ...hourStats.map((s) => s.v))

  const topItems = useMemo(() => {
    const acc = {}
    for (const o of paid) {
      for (const i of o.items || []) {
        const t = acc[i.title] || (acc[i.title] = { title: i.title, qty: 0, sum: 0 })
        t.qty += i.quantity || 0
        t.sum += i.total_price ?? (i.price || 0) * (i.quantity || 0)
      }
    }
    return Object.values(acc)
      .sort((a, b) => b.qty - a.qty || b.sum - a.sum)
      .slice(0, 4)
  }, [paid])

  const onShare = async () => {
    const lines = [
      isCurrent ? 'Текущая смена' : `Смена ${dayShort(shift.start_time)}`,
      `${formatTime(shift.start_time)} – ${isCurrent ? 'идёт' : formatTime(endSec)} · ${formatDuration(endSec - shift.start_time)}`,
      `Касса ${formatMoney(cash, currency)} · ${count} ${pluralize(count, ['заказ', 'заказа', 'заказов'])}${count > 0 ? ` · средний чек ${formatMoney(Math.round(cash / count), currency)}` : ''}`,
      `Чаевые ${formatMoney(tips, currency)}${tipsPct ? ` (${tipsPct}% от кассы)` : ''}`,
      `Заработано ${formatMoney(shift.total_pay_for_shift || 0, currency)} (${condSub})`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      useUiStore.getState().toastSuccess('Отчёт скопирован')
    } catch {
      useUiStore.getState().toastError('Не удалось скопировать')
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить смену?',
      message: 'Все заказы этой смены будут удалены безвозвратно.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useShiftStore.getState().remove(shift.id)
      ui.toastSuccess('Смена удалена')
      onDeleted?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <WnSheet
      title={isCurrent ? 'Текущая смена' : `Смена ${dayShort(shift.start_time)}`}
      onClose={onClose}
    >
          <div className="rep-summary">
            <div className="rep-sumrow">
              <span className="rep-sumrow-label">Заработано</span>
              <span className="rep-sumrow-right">
                <span className="rep-sumrow-value rep-sumrow-value--big">
                  {formatMoney(shift.total_pay_for_shift || 0, currency)}
                </span>
                <span className="rep-sumrow-sub">{condSub}</span>
              </span>
            </div>
            <div className="rep-sumrow">
              <span className="rep-sumrow-label">Время</span>
              <span className="rep-sumrow-right">
                <span className="rep-sumrow-value">
                  {formatTime(shift.start_time)} – {isCurrent ? 'идёт' : formatTime(endSec)} ·{' '}
                  {formatDuration(endSec - shift.start_time)}
                </span>
              </span>
            </div>
            <div className="rep-sumrow">
              <span className="rep-sumrow-label">Касса</span>
              <span className="rep-sumrow-right">
                <span className="rep-sumrow-value">{formatMoney(cash, currency)}</span>
              </span>
            </div>
            <div className="rep-sumrow">
              <span className="rep-sumrow-label">Чаевые</span>
              <span className="rep-sumrow-right">
                <span className="rep-sumrow-value">{formatMoney(tips, currency)}</span>
                {tips > 0 && tipsPct && (
                  <span className="rep-sumrow-sub">{tipsPct}% от кассы</span>
                )}
              </span>
            </div>
            <div className="rep-sumrow">
              <span className="rep-sumrow-label">Заказов</span>
              <span className="rep-sumrow-right">
                <span className="rep-sumrow-value">{count}</span>
              </span>
            </div>
            {count > 0 && (
              <div className="rep-sumrow">
                <span className="rep-sumrow-label">Средний чек</span>
                <span className="rep-sumrow-right">
                  <span className="rep-sumrow-value">
                    {formatMoney(Math.round(cash / count), currency)}
                  </span>
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="rep-orders-loading">
              <div className="shh-spinner" />
            </div>
          ) : rows.length === 0 ? (
            <div className="rep-orders-empty">
              Заказов пока нет — они появятся в отчёте по мере закрытия
            </div>
          ) : (
            <>
              <div className="shs-label rep-label">Выручка по часам</div>
              <div className="rep-bars">
                {hourStats.map((s) => (
                  <div
                    key={s.h}
                    className={`rep-bar${s.v > 0 ? '' : ' rep-bar--empty'}`}
                    style={{
                      height: s.v > 0 ? Math.max(8, Math.round((64 * s.v) / maxHour)) : 5,
                    }}
                  />
                ))}
              </div>
              <div className="rep-bars-hours">
                {hourStats.map((s) => (
                  <div key={s.h} className="rep-bars-hour">{s.h}</div>
                ))}
              </div>

              <div className="shs-label rep-label--tight">Топ позиций</div>
              <div>
                {topItems.map((t) => (
                  <div key={t.title} className="rep-top-row">
                    <span className="rep-top-title">{t.title}</span>
                    <span className="rep-top-qty">× {t.qty}</span>
                    <span className="rep-top-spacer" />
                    <span className="rep-top-sum">{formatMoney(t.sum, currency)}</span>
                  </div>
                ))}
              </div>

              <div className="shs-label rep-label--tight">Заказы · {rows.length}</div>
              <div>
                {rows.map((o, i) => (
                  <div key={o.id || i} className="rep-order-wrap">
                    <ShiftOrderRow
                      order={o}
                      currency={currency}
                      onTap={onOrderTap ? () => onOrderTap(o) : undefined}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="button" className="rep-share" onClick={onShare}>
            <ShareIcon width={19} height={19} /> Поделиться отчётом
          </button>
          {!isCurrent && (
            <button
              type="button"
              className="rep-delete"
              disabled={busy}
              onClick={onDelete}
            >
              Удалить смену
            </button>
          )}
    </WnSheet>
  )
}
