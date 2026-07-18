import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney, formatTime } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'
import { hapticImpact } from '@/utils/telegram'
import { useLiveDuration } from '@/hooks/useLiveDuration'
import WnSheet from '@/components/WnSheet'
import TablePickerSheet from './TablePickerSheet'
import {
  CheckIcon,
  PlusIcon,
  MapIcon,
  TrashIcon,
} from '@/components/menu/menuIcons'
import '@/styles/order-sheet.css'

/**
 * Карточка заказа — 1:1 UoActiveSheet / UoClosedSheet из прототипа
 * waiter-note-unified (unified-prototype/order-sheet.jsx), полноэкранный
 * WnSheet.
 *
 * Активный заказ:
 *   • мета «Зал · открыт в HH:MM · N мин (warn>30) · K гостей»;
 *   • «ПОЗИЦИИ» + «подано X из Y» + прогресс-бар; тап по строке
 *     переключает «подано» (у позиции это флаг, не счётчик по штукам —
 *     см. отклонения в ответе), корзинка → confirm (последняя позиция
 *     закрывает заказ целиком);
 *   • «＋ Добавить позиции» → сборка (add-режим), «Другой стол» →
 *     TablePickerSheet (SVG-карта залов, занятые недоступны, есть
 *     «Без стола») — решение владельца вместо сетки из прототипа;
 *   • тумблер «Разделить счёт по гостям» (при >1 гостя в позициях) —
 *     группирует позиции с подытогами; оплата остаётся общей (частичной
 *     оплаты по гостю на бэке нет);
 *   • Итого; чаевые Без/5%/10%/Свои (модалка с суммой и ≈%);
 *   • «Подать всё» + «Оплатить <итого+чаевые>» (без confirm — как в
 *     прототипе; «Вернуть в активные» страхует), «Удалить заказ».
 *
 * Чек (paidMode):
 *   • чип «Оплачен в HH:MM» + «Зал · K гостей»; позиции read-only;
 *     Чаевые (тап — правка через ту же модалку, если передан onEdit);
 *     Итого; кнопки «Изменить» / «Вернуть в активные» — только когда
 *     переданы обработчики (история текущей смены). Для заказов
 *     закрытых смен — чистый чек.
 *
 * Props (совместимы со старым компонентом): visible, order, paidMode,
 * onClose, onReopen, onEdit.
 */

/* ── строка позиции (общая для активного и чека) ── */
function PosRow({ item, currency, editable, onTap, onDelete }) {
  const qty = item.quantity || 1
  const srv = Math.min(Number(item.served) || 0, qty)
  const full = srv >= qty
  const part = srv > 0 && !full
  const inner = (
    <>
      {editable && (
        <span
          className={`uo-pos-served${full ? ' uo-pos-served--on' : ''}${part ? ' uo-pos-served--part' : ''}`}
          aria-hidden
        >
          {full && <CheckIcon width={15} height={15} />}
          {part && <span className="uo-pos-served-count">{srv}/{qty}</span>}
        </span>
      )}
      <span className="uo-pos-main">
        <span className={`uo-pos-title${editable && full ? ' uo-pos-title--served' : ''}`}>
          {item.title}
        </span>
        <span className="uo-pos-price">
          {formatMoney(item.price, currency)} × {item.quantity}
        </span>
        {item.comment && <span className="uo-pos-note">{item.comment}</span>}
      </span>
      <span className="uo-pos-sum">{formatMoney(item.total_price, currency)}</span>
      {editable && onDelete && (
        <span
          className="uo-pos-del"
          role="button"
          aria-label="Удалить позицию"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <TrashIcon width={17} height={17} />
        </span>
      )}
    </>
  )
  if (!editable) return <div className="uo-pos">{inner}</div>
  return (
    <button type="button" className="uo-pos uo-pos--tap" onClick={onTap}>
      {inner}
    </button>
  )
}

function TotalRow({ label, value, big, onTap }) {
  const cls = `uo-total${big ? ' uo-total--big' : ''}${onTap ? ' uo-total--tap' : ''}`
  const inner = (
    <>
      <span className="uo-total-label">{label}</span>
      <span className="uo-total-value">{value}</span>
    </>
  )
  if (!onTap) return <div className={cls}>{inner}</div>
  return (
    <button type="button" className={cls} onClick={onTap}>
      {inner}
    </button>
  )
}

/* ── «Свои чаевые» — ввод суммы (на базе .sheet) ── */
function TipsModal({ total, currency, initial, onClose, onSave }) {
  const [val, setVal] = useState(String(initial || ''))
  const num = parseInt(String(val).replace(/[^\d]/g, ''), 10) || 0
  const pct = total > 0 && num > 0 ? Math.round((num / total) * 100) : 0
  return (
    <div
      className="sheet-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">Свои чаевые</h3>
          <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="sheet-form">
          <label className="uo-tip-label">Сумма, {currency === 'RUB' ? '₽' : currency}</label>
          <input
            className="uo-tip-input"
            value={val}
            inputMode="numeric"
            placeholder="0"
            autoFocus
            onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ''))}
          />
          <div className="uo-tip-hint">
            {num > 0
              ? `≈ ${pct} % от счёта ${formatMoney(total, currency)}`
              : `Счёт — ${formatMoney(total, currency)}`}
          </div>
          <div className="uo-tip-quick">
            {[100, 200, 300, 500].map((s) => (
              <button
                key={s}
                type="button"
                className="uo-tip-quick-chip"
                onClick={() => setVal(String(s))}
              >
                {s} ₽
              </button>
            ))}
          </div>
          <div className="sheet-actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Отмена
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={num <= 0}
              onClick={() => onSave(num)}
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetailsSheet({
  visible = false,
  order = null,
  paidMode = false,
  onClose,
  onReopen,
  onEdit,
}) {
  const navigate = useNavigate()
  const orders = useOrderStore((s) => s.orders)
  const workplaceCurrency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const [busy, setBusy] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [split, setSplit] = useState(false)
  const [tipsPct, setTipsPct] = useState(0) // 0 | 5 | 10 | 'custom'
  const [tipsCustom, setTipsCustom] = useState(0)
  const [tipsOpen, setTipsOpen] = useState(false)

  // Пока шит открыт — глобальный оверлей (FAB прячется).
  useEffect(() => {
    if (!visible) return undefined
    const ui = useUiStore.getState()
    ui.pushOverlay()
    return () => ui.popOverlay()
  }, [visible])

  // Свежий заказ из стора (fallback на проп — заказы закрытых смен в
  // сторе не живут).
  const liveOrder = useMemo(() => {
    const id = order?.id
    if (!id) return order
    return orders.find((o) => o.id === id) || order
  }, [orders, order])

  const currency = liveOrder?.currency || workplaceCurrency
  const items = useMemo(() => liveOrder?.items || [], [liveOrder])

  const pos = items.reduce((s, i) => s + (i.quantity || 0), 0)
  // поштучно: подано = сумма served-счётчиков (клампим на всякий)
  const served = items.reduce(
    (s, i) => s + Math.min(Number(i.served) || 0, i.quantity || 0),
    0,
  )
  const total = liveOrder?.total_price || 0

  const guests = useMemo(
    () => [...new Set(items.map((i) => i.guest || 1))].sort((a, b) => a - b),
    [items],
  )
  const canSplit = guests.length > 1

  const seconds = useLiveDuration(() => liveOrder?.created_at)
  const mins = Math.floor(seconds / 60)

  const tips =
    tipsPct === 'custom'
      ? tipsCustom
      : Math.round((total * tipsPct) / 100 / 10) * 10

  if (!visible || !liveOrder) return null

  const title =
    liveOrder.table_number != null ? `Стол №${liveOrder.table_number}` : 'Заказ без стола'

  /* ── обработчики (store-логика прежняя) ── */

  const onToggleServed = async (item) => {
    hapticImpact('light')
    try {
      await useOrderStore.getState().toggleItemServed(liveOrder.id, item.id)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  const onServeAll = async () => {
    if (busy) return
    hapticImpact('light')
    setBusy(true)
    try {
      const store = useOrderStore.getState()
      const pending = items.filter(
        (i) => (Number(i.served) || 0) < (i.quantity || 1),
      )
      for (const i of pending) {
        await store.updateOrderItem(i.id, { served: i.quantity || 1 })
      }
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDeleteItem = async (item) => {
    const ui = useUiStore.getState()
    const last = items.length === 1
    const ok = await ui.confirm({
      title: 'Удалить позицию?',
      message: last
        ? `«${item.title}» — последняя позиция. Вместе с ней будет удалён весь заказ.`
        : `«${item.title}» × ${item.quantity} — ${formatMoney(item.total_price, currency)}. Позиция будет убрана из заказа.`,
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      if (last) {
        await useOrderStore.getState().deleteOrder(liveOrder.id)
        ui.toastSuccess('Последняя позиция удалена — заказ закрыт')
        onClose?.()
      } else {
        await useOrderStore.getState().removeOrderItem(item.id)
      }
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onAddItems = () => {
    onClose?.()
    navigate(`/order-builder?add_to_order=${encodeURIComponent(liveOrder.id)}`)
  }

  const onPay = async () => {
    if (busy || items.length === 0) return
    setBusy(true)
    try {
      await useOrderStore.getState().payOrder(liveOrder.id, { tips })
      useUiStore
        .getState()
        .toastSuccess(
          `Оплачено ${formatMoney(total + tips, currency)}${tips > 0 ? `, чаевые ${formatMoney(tips, currency)}` : ''}`,
        )
      onClose?.()
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onPickMove = async (tableId) => {
    setMoveOpen(false)
    if (tableId === (liveOrder.table_id || null)) return // тот же стол
    setBusy(true)
    try {
      const updated = await useOrderStore.getState().moveOrder(liveOrder.id, tableId)
      useUiStore
        .getState()
        .toastSuccess(
          tableId != null
            ? `Заказ перенесён на стол №${updated.table_number}`
            : 'Заказ снят со стола',
        )
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDeleteOrder = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить заказ?',
      message: 'Стол освободится. Действие нельзя отменить.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().deleteOrder(liveOrder.id)
      ui.toastSuccess('Заказ удалён')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Правка чаевых закрытого заказа — та же модалка «Свои чаевые».
  const onSavePaidTips = async (value) => {
    setTipsOpen(false)
    setBusy(true)
    try {
      await useOrderStore.getState().editPaidOrder(liveOrder.id, { tips: value })
      useUiStore.getState().toastSuccess('Чаевые сохранены')
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const guestsLabel = `${liveOrder.guests_count || 1} ${pluralize(liveOrder.guests_count || 1, ['гость', 'гостя', 'гостей'])}`

  const rows = (list, editable) =>
    list.map((it, k) => (
      <div key={it.id ?? k} className="uo-pos-wrap">
        <PosRow
          item={it}
          currency={currency}
          editable={editable}
          onTap={() => onToggleServed(it)}
          onDelete={() => onDeleteItem(it)}
        />
      </div>
    ))

  /* ── чек (закрытый заказ) ── */
  if (paidMode) {
    const canAct = !!(onReopen || onEdit)
    return (
      <>
        <WnSheet title={title} onClose={onClose}>
          <div className="uo-paid-head">
            <span className="uo-paid-chip">Оплачен в {formatTime(liveOrder.closed_at)}</span>
            <span className="uo-paid-meta">
              {liveOrder.hall_name ? `${liveOrder.hall_name} · ` : ''}
              {guestsLabel}
            </span>
          </div>

          {liveOrder.comments && (
            <div className="uo-comment" style={{ marginTop: 10 }}>
              <div className="uo-comment-label">Комментарий</div>
              <div className="uo-comment-text">{liveOrder.comments}</div>
            </div>
          )}

          <div style={{ marginTop: 10 }}>{rows(items, false)}</div>

          <div className="uo-divider" style={{ margin: '10px 0 2px' }} aria-hidden />
          <TotalRow
            label="Чаевые"
            value={
              (Number(liveOrder.tips) || 0) > 0
                ? `+${formatMoney(liveOrder.tips, currency)}`
                : onEdit
                  ? 'Добавить'
                  : formatMoney(0, currency)
            }
            onTap={onEdit ? () => setTipsOpen(true) : undefined}
          />
          <TotalRow big label="Итого" value={formatMoney(total, currency)} />

          {canAct && (
            <div className="uo-paid-actions">
              {onEdit && (
                <button
                  type="button"
                  className="uo-ghost"
                  disabled={busy}
                  onClick={() => onEdit(liveOrder)}
                >
                  Изменить
                </button>
              )}
              {onReopen && (
                <button
                  type="button"
                  className="uo-ghost uo-ghost--accent"
                  disabled={busy}
                  onClick={() => onReopen(liveOrder)}
                >
                  Вернуть в активные
                </button>
              )}
            </div>
          )}
        </WnSheet>
        {tipsOpen && (
          <TipsModal
            total={total}
            currency={currency}
            initial={Number(liveOrder.tips) || ''}
            onClose={() => setTipsOpen(false)}
            onSave={onSavePaidTips}
          />
        )}
      </>
    )
  }

  /* ── активный заказ ── */
  return (
    <>
      <WnSheet title={title} onClose={onClose}>
        <div className="uo-meta">
          {liveOrder.hall_name ? `${liveOrder.hall_name} · ` : ''}
          открыт в {formatTime(liveOrder.created_at)} ·{' '}
          <span className={mins > 30 ? 'uo-meta-warn' : undefined}>{mins} мин</span> ·{' '}
          {guestsLabel}
        </div>

        <div className="uo-progress-wrap">
          <div className="uo-progress-head">
            <span className="uo-progress-label">Позиции</span>
            <span
              className={`uo-progress-count${pos > 0 && served >= pos ? ' uo-progress-count--all' : ''}`}
            >
              {pos > 0 && served >= pos ? 'подано всё' : `подано ${served} из ${pos}`}
            </span>
          </div>
          <div className="uo-progress-track">
            <div
              className="uo-progress-fill"
              style={{ width: `${pos ? (served / pos) * 100 : 0}%` }}
            />
          </div>
        </div>

        {split && canSplit ? (
          guests.map((g) => {
            const mine = items.filter((i) => (i.guest || 1) === g)
            const sub = mine.reduce((s, i) => s + (i.total_price || 0), 0)
            return (
              <div key={g} className="uo-guest">
                <div className="uo-guest-head">
                  <span className="uo-guest-badge">{g}</span>
                  <span className="uo-guest-name">Гость {g}</span>
                  <span className="uo-guest-sum">{formatMoney(sub, currency)}</span>
                </div>
                <div className="uo-guest-list">{rows(mine, true)}</div>
              </div>
            )
          })
        ) : (
          <div className="uo-list">{rows(items, true)}</div>
        )}

        {liveOrder.comments && (
          <div className="uo-comment">
            <div className="uo-comment-label">Комментарий</div>
            <div className="uo-comment-text">{liveOrder.comments}</div>
          </div>
        )}

        <div className="uo-actions">
          <button
            type="button"
            className="uo-ghost uo-ghost--accent"
            disabled={busy}
            onClick={onAddItems}
          >
            <PlusIcon width={17} height={17} /> Добавить позиции
          </button>
          <button
            type="button"
            className="uo-ghost"
            disabled={busy}
            onClick={() => setMoveOpen(true)}
          >
            <span className="uo-ghost-ico" aria-hidden>
              <MapIcon width={17} height={17} />
            </span>{' '}
            Другой стол
          </button>
        </div>

        {canSplit && (
          <div className="uo-split">
            <span className="uo-split-main">
              <span className="uo-split-title">Разделить счёт по гостям</span>
              <span className="uo-split-sub">
                {split
                  ? 'Подытоги по каждому гостю'
                  : `${guests.length} ${pluralize(guests.length, ['гость', 'гостя', 'гостей'])} — один счёт`}
              </span>
            </span>
            <button
              type="button"
              className={`uo-switch${split ? ' uo-switch--on' : ''}`}
              role="switch"
              aria-checked={split}
              aria-label="Разделить счёт по гостям"
              onClick={() => setSplit((v) => !v)}
            />
          </div>
        )}

        <div className="uo-divider" aria-hidden />
        <TotalRow big label="Итого" value={formatMoney(total, currency)} />

        <div className="uo-tips">
          <span className="uo-tips-label">Чаевые</span>
          {[
            [0, 'Без'],
            [5, '5 %'],
            [10, '10 %'],
          ].map(([p, l]) => (
            <button
              key={p}
              type="button"
              className={`uo-tips-chip${tipsPct === p ? ' uo-tips-chip--on' : ''}`}
              onClick={() => setTipsPct(p)}
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            className={`uo-tips-chip${tipsPct === 'custom' ? ' uo-tips-chip--on' : ''}`}
            onClick={() => setTipsOpen(true)}
          >
            {tipsPct === 'custom' ? `${tipsCustom} ₽` : 'Свои'}
          </button>
          {tips > 0 && (
            <span className="uo-tips-sum">+{formatMoney(tips, currency)}</span>
          )}
        </div>

        <div className="uo-footer">
          {served < pos && (
            <button
              type="button"
              className="uo-serve-all"
              disabled={busy}
              onClick={onServeAll}
            >
              Подать всё
            </button>
          )}
          <button
            type="button"
            className="uo-pay"
            disabled={busy || items.length === 0}
            onClick={onPay}
          >
            {busy ? '…' : `Оплатить ${formatMoney(total + tips, currency)}`}
          </button>
        </div>

        <button
          type="button"
          className="uo-delete-order"
          disabled={busy}
          onClick={onDeleteOrder}
        >
          Удалить заказ
        </button>
      </WnSheet>

      <TablePickerSheet
        visible={moveOpen}
        currentTableId={liveOrder.table_id || null}
        freeOnly
        onClose={() => setMoveOpen(false)}
        onSelect={onPickMove}
      />
      {tipsOpen && (
        <TipsModal
          total={total}
          currency={currency}
          initial={tipsPct === 'custom' ? tipsCustom : ''}
          onClose={() => setTipsOpen(false)}
          onSave={(v) => {
            setTipsCustom(v)
            setTipsPct('custom')
            setTipsOpen(false)
          }}
        />
      )}
    </>
  )
}