import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney, formatDuration } from '@/utils/format'
import { hapticImpact } from '@/utils/telegram'
import { useLiveDuration } from '@/hooks/useLiveDuration'

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
 * ── Deferred ────────────────────────────────────────────────────────
 * "Перенести на другой стол" opens TablePickerSheet, which isn't ported
 * yet (it lands with the Map/Hall work). The button is present but routes
 * the user to the map for now. Paid mode (history) never shows move, so
 * OrderHistoryView is fully functional regardless.
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
  const [tipsAmount, setTipsAmount] = useState('')
  // NOTE: tips reset on order change is handled by remounting via a
  // key={order.id} at the call site (OrderHistoryView / Map), so no
  // setState-in-effect is needed here.

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

  const tipsValue = useMemo(() => {
    const n = Number(tipsAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [tipsAmount])

  const totalToPay = (liveOrder?.total_price || 0) + tipsValue
  const paidTips = paidMode
    ? (() => {
        const n = Number(liveOrder?.tips)
        return Number.isFinite(n) && n > 0 ? n : 0
      })()
    : tipsValue
  const finalTotal = (liveOrder?.total_price || 0) + paidTips

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

  const onAddItems = () => {
    if (!order) return
    onClose?.()
    navigate(`/order-builder?add_to_order=${encodeURIComponent(order.id)}`)
  }

  const onPay = async () => {
    if (!order || busy) return
    const ui = useUiStore.getState()
    const amountLabel = formatMoney(totalToPay, currency)
    const tipsLine =
      tipsValue > 0 ? ` (включая ${formatMoney(tipsValue, currency)} чаевых)` : ''
    const ok = await ui.confirm({
      title: 'Подтвердить оплату?',
      message: `Сумма: ${amountLabel}${tipsLine}. После подтверждения заказ закроется и стол освободится.`,
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
    // TablePickerSheet not ported yet — send the user to the map to move
    // the order there. Restored to an in-sheet picker with the Map work.
    if (!order) return
    onClose?.()
    navigate(`/map?show_order=${encodeURIComponent(order.id)}`)
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

  return (
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
            <ul className="ods-items">
              {orderItems.map((i) => (
                <li
                  key={i.id}
                  className={i.served ? 'ods-item ods-item--served' : 'ods-item'}
                >
                  <button
                    className={
                      i.served ? 'ods-served ods-served--on' : 'ods-served'
                    }
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
                    {i.comment && (
                      <div className="ods-item-comment">💬 {i.comment}</div>
                    )}
                  </div>
                  <div className="ods-item-price">
                    {formatMoney(i.total_price, currency)}
                  </div>
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
              ))}
            </ul>
          ) : (
            liveOrder && (
              <div className="ods-empty-items">
                <p>В этом заказе пока нет позиций.</p>
              </div>
            )
          )}

          {orderItems.length > 0 && !paidMode && (
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
            </div>
          )}

          {orderItems.length > 0 && (
            <div className="ods-totals">
              <div className="ods-totals-row">
                <span>Сумма</span>
                <span className="ods-totals-value">
                  {formatMoney(liveOrder.total_price, currency)}
                </span>
              </div>
              {paidTips > 0 && (
                <div className="ods-totals-row ods-totals-row--small">
                  <span>Чаевые</span>
                  <span className="ods-totals-value">
                    {formatMoney(paidTips, currency)}
                  </span>
                </div>
              )}
              <div className="ods-totals-row ods-totals-row--main">
                <span>{paidMode ? 'Итого' : 'К оплате'}</span>
                <span className="ods-totals-value">
                  {formatMoney(finalTotal, currency)}
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
  )
}