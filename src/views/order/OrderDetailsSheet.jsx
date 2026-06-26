import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney, formatDuration } from '@/utils/format'
import { hapticImpact } from '@/utils/telegram'
import { useLiveDuration } from '@/hooks/useLiveDuration'
import TablePickerSheet from './TablePickerSheet'
import '@/styles/order-guests.css'

/**
 * Order details sheet — two modes: active (pay/add/move/delete) and paid
 * (reopen/edit). (Was OrderDetailsSheet.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - liveOrder: re-reads the order from the store by id each render so
 *   optimistic updates (served toggle) reflect instantly. Was a computed;
 *   here useMemo over the store's orders + the prop fallback.
 * - watch(order.id) resetting tips → useEffect keyed on order?.id.
 * - useLiveDuration composable → hook.
 * - $emit('close'|'reopen'|'edit') → onClose / onReopen / onEdit.
 *
 * ── Move ────────────────────────────────────────────────────────────
 * "Перенести на другой стол" opens TablePickerSheet inline (state
 * movePickerVisible); picking a table calls moveOrder, picking "Без стола"
 * detaches. Paid mode (history) never shows move.
 * ─────────────────────────────────────────────────────────────────────
 */
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
  const [movePickerVisible, setMovePickerVisible] = useState(false)
  // Prefill from the order's saved tips in paid mode so history can quickly
  // correct a forgotten tip. The sheet remounts per order (key={order.id}),
  // so this initializer runs fresh for each opened order.
  const [tipsAmount, setTipsAmount] = useState(() =>
    paidMode && order?.tips ? String(order.tips) : '',
  )
  // NOTE: tips reset on order change is handled by remounting via a
  // key={order.id} at the call site (OrderHistoryView / Map), so no
  // setState-in-effect is needed here.

  // While the sheet is open, register a global overlay so the floating
  // "Взять заказ" CTA hides — otherwise it overlaps "Оплатить"/"+ Позиции".
  useEffect(() => {
    if (!visible) return undefined
    const ui = useUiStore.getState()
    ui.pushOverlay()
    return () => ui.popOverlay()
  }, [visible])

  // Fresh order from the store (fallback to prop for paid/history orders
  // that may not be in the active orders list).
  const liveOrder = useMemo(() => {
    const id = order?.id
    if (!id) return order
    return orders.find((o) => o.id === id) || order
  }, [orders, order])

  const currency = liveOrder?.currency || workplaceCurrency
  const orderItems = liveOrder?.items || []
  const canPay = orderItems.length > 0
  const guestsCount = liveOrder?.guests_count || 1

  const tipsValue = useMemo(() => {
    const n = Number(tipsAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [tipsAmount])

  // Tips are recorded separately (waiter's earnings / shift tips) — they are
  // NOT part of the order's cost, so "Сумма"/"К оплате"/"Итого" всегда равны
  // стоимости позиций заказа. Чаевые показываем отдельной строкой. The input
  // drives the displayed tips in both modes (in paid mode it's prefilled).
  const orderTotal = liveOrder?.total_price || 0
  const paidTips = tipsValue
  // In history, allow saving an edited tip (e.g. a forgotten one).
  const savedTips = Number(liveOrder?.tips) || 0
  const tipsDirty = paidMode && tipsValue !== savedTips

  const seconds = useLiveDuration(() => liveOrder?.created_at)
  const openedAgo = formatDuration(seconds)
  const closedAtLabel = liveOrder?.closed_at
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(liveOrder.closed_at * 1000),
      )
    : ''

  if (!visible) return null

  const onToggleServed = async (item) => {
    if (!order) return
    hapticImpact('light')
    try {
      await useOrderStore.getState().toggleItemServed(order.id, item.id)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  const onRemoveItem = async (item) => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Убрать позицию?',
      message: `«${item.title}» будет удалена из заказа.`,
      confirmText: 'Убрать',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().removeOrderItem(item.id)
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Quick-save tips on a closed order (history) without the full edit flow.
  const onSaveTips = async () => {
    if (!order || busy) return
    setBusy(true)
    try {
      await useOrderStore.getState().editPaidOrder(order.id, { tips: tipsValue })
      useUiStore.getState().toastSuccess('Чаевые сохранены')
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onAddItems = () => {
    if (!order) return
    onClose?.()
    navigate(`/order-builder?add_to_order=${encodeURIComponent(order.id)}`)
  }

  const onPay = async () => {
    if (!order || busy) return
    const ui = useUiStore.getState()
    const amountLabel = formatMoney(orderTotal, currency)
    const tipsLine =
      tipsValue > 0
        ? ` Чаевые ${formatMoney(tipsValue, currency)} будут записаны отдельно.`
        : ''
    const ok = await ui.confirm({
      title: 'Подтвердить оплату?',
      message: `К оплате: ${amountLabel}.${tipsLine} После подтверждения заказ закроется и стол освободится.`,
      confirmText: 'Подтвердить',
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().payOrder(order.id, { tips: tipsValue })
      ui.toastSuccess('Заказ оплачен')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onMove = () => {
    if (!order) return
    setMovePickerVisible(true)
  }

  // Pick a target table to move (or detach) the order.
  const onPickMoveTable = async (tableId) => {
    setMovePickerVisible(false)
    if (!order) return
    setBusy(true)
    try {
      const updated = await useOrderStore.getState().moveOrder(order.id, tableId)
      useUiStore
        .getState()
        .toastSuccess(
          tableId
            ? `Перенесено · стол №${updated.table_number}`
            : 'Заказ откреплён от стола',
        )
      onClose?.()
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!order) return
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
      await useOrderStore.getState().deleteOrder(order.id)
      ui.toastSuccess('Заказ удалён')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  // Single order line (shared by flat list and per-guest groups).
  const renderOrderItem = (i) => (
    <li key={i.id} className={i.served ? 'ods-item ods-item--served' : 'ods-item'}>
      <button
        className={i.served ? 'ods-served ods-served--on' : 'ods-served'}
        aria-label={i.served ? 'Не подано' : 'Подано'}
        onClick={() => onToggleServed(i)}
      >
        {i.served && (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="ods-item-main">
        <div className="ods-item-title">
          <span>{i.title}</span>
          <span className="ods-item-qty">× {i.quantity}</span>
        </div>
        {i.comment && <div className="ods-item-comment">💬 {i.comment}</div>}
      </div>
      <div className="ods-item-price">{formatMoney(i.total_price, currency)}</div>
      {!paidMode && (
        <button
          className="ods-item-remove"
          disabled={busy}
          aria-label="Удалить позицию"
          onClick={() => onRemoveItem(i)}
        >
          ×
        </button>
      )}
    </li>
  )

  return (
    <>
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet ods-sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <div className="ods-header-main">
            <h3 className="sheet-title">
              {liveOrder?.table_number
                ? `Стол №${liveOrder.table_number}`
                : 'Заказ без стола'}
            </h3>
            {liveOrder && (
              <span className="ods-meta">
                {paidMode
                  ? `✓ Закрыт ${closedAtLabel} · ${formatMoney(liveOrder.total_price, currency)}`
                  : `⏱ ${openedAgo} · ${formatMoney(liveOrder.total_price, currency)}`}
              </span>
            )}
          </div>
          <button className="sheet-close" onClick={() => onClose?.()}>
            ×
          </button>
        </header>

        <div className="ods-content">
          {liveOrder?.comments && (
            <div className="ods-comments">
              <span className="ods-comments-label">💬 Комментарий</span>
              <p>{liveOrder.comments}</p>
            </div>
          )}

          {orderItems.length > 0 ? (
            guestsCount <= 1 ? (
              <ul className="ods-items">{orderItems.map(renderOrderItem)}</ul>
            ) : (
              Array.from({ length: guestsCount }, (_, gi) => gi + 1).map((g) => {
                const guestItems = orderItems.filter((it) => (it.guest || 1) === g)
                if (guestItems.length === 0) return null
                const subtotal = guestItems.reduce((s, it) => s + (it.total_price || 0), 0)
                return (
                  <div className="cc-guest-group" key={g}>
                    <div className="cc-guest-head">
                      <span className="cc-guest-name">
                        <span className="cc-guest-badge">{g}</span>
                        Гость {g}
                      </span>
                      <span className="cc-guest-subtotal">
                        {formatMoney(subtotal, currency)}
                      </span>
                    </div>
                    <ul className="ods-items">{guestItems.map(renderOrderItem)}</ul>
                  </div>
                )
              })
            )
          ) : (
            liveOrder && (
              <div className="ods-empty-items">
                <p>В этом заказе пока нет позиций.</p>
              </div>
            )
          )}

          {orderItems.length > 0 && (
            <div className="ods-tips-row">
              <label className="ods-tips-label">Чаевые</label>
              <div className="ods-tips-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0"
                  className="ods-tips-input"
                  value={tipsAmount}
                  onChange={(e) => setTipsAmount(e.target.value)}
                />
                <span className="ods-tips-currency">{currency}</span>
              </div>
              {tipsDirty && (
                <button
                  className="ods-tips-save"
                  onClick={onSaveTips}
                  disabled={busy}
                >
                  {busy ? '…' : 'Сохранить'}
                </button>
              )}
            </div>
          )}

          {orderItems.length > 0 && (
            <div className="ods-totals">
              <div className="ods-totals-row">
                <span>Заказ</span>
                <span className="ods-totals-value">
                  {formatMoney(orderTotal, currency)}
                </span>
              </div>
              {paidTips > 0 && (
                <div className="ods-totals-row ods-totals-row--small">
                  <span>Чаевые (отдельно)</span>
                  <span className="ods-totals-value">
                    {formatMoney(paidTips, currency)}
                  </span>
                </div>
              )}
              <div className="ods-totals-row ods-totals-row--main">
                <span>{paidMode ? 'Итого по заказу' : 'К оплате'}</span>
                <span className="ods-totals-value">
                  {formatMoney(orderTotal, currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {!paidMode ? (
          <>
            <footer className="ods-footer">
              <button className="btn btn--ghost" onClick={onAddItems} disabled={busy}>
                + Позиции
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !canPay}
                onClick={onPay}
              >
                {busy ? '…' : 'Оплатить'}
              </button>
            </footer>
            <div className="ods-more">
              <button className="ods-more-btn" onClick={onMove} disabled={busy}>
                Перенести на другой стол
              </button>
              <button
                className="ods-more-btn ods-more-btn--danger"
                onClick={onDelete}
                disabled={busy}
              >
                Удалить заказ
              </button>
            </div>
          </>
        ) : (
          <footer className="ods-footer">
            <button
              className="btn btn--ghost"
              onClick={() => onEdit?.(order)}
              disabled={busy}
            >
              ✏️ Изменить
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onReopen?.(order)}
              disabled={busy}
            >
              ↩ Вернуть в активные
            </button>
          </footer>
        )}
      </div>
    </div>

    <TablePickerSheet
      visible={movePickerVisible}
      currentTableId={order?.table_id || null}
      freeOnly={true}
      onClose={() => setMovePickerVisible(false)}
      onSelect={onPickMoveTable}
    />
    </>
  )
}
