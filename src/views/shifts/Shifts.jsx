import { useEffect, useState } from 'react'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import CurrentShiftCard from './CurrentShiftCard'
import OpenShiftButton from './OpenShiftButton'
import ShiftHistoryItem from './ShiftHistoryItem'
import ShiftDetailsModal from './ShiftDetailsModal'

/**
 * Shifts screen. (Was shift.vue.)
 * - onMounted(fetchHistory-if-empty) → useEffect keyed on currentId.
 * - opening/closing/detailsShift → useState.
 * - The close flow keeps the Vue 409 handling: a clean close first, and on
 *   409 (unpaid orders) a confirm to force-close (auto-pay tips=0).
 */
export default function Shifts() {
  const current = useShiftStore((s) => s.current)
  const history = useShiftStore((s) => s.history)
  const historyHasMore = useShiftStore((s) => s.historyHasMore)
  const isLoadingHistory = useShiftStore((s) => s.isLoadingHistory)

  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')

  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [detailsShift, setDetailsShift] = useState(null)

  // History is normally fetched on workplace switch (App effect). If the
  // user lands here first after boot with nothing loaded, fetch now.
  useEffect(() => {
    const s = useShiftStore.getState()
    if (currentId && s.history.length === 0 && s.historyHasMore) {
      s.fetchHistory(currentId).catch((e) =>
        useUiStore.getState().toastError(e.message),
      )
    }
  }, [currentId])

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

  // After any close, the hall store still thinks tables are occupied —
  // refetch so the map frees them. Non-fatal on failure.
  const syncMapAfterShiftClose = async () => {
    if (!currentId) return
    try {
      await useHallStore.getState().fetchAll(currentId)
    } catch {
      /* map reconciles on next visit */
    }
  }

  const onCloseShift = async () => {
    const shift = useShiftStore.getState()
    const ui = useUiStore.getState()
    const cur = shift.current
    if (!cur) return

    setClosing(true)
    try {
      // Clean close first; backend 409s if unpaid orders remain.
      await shift.close(cur.id, { force: false })
      await syncMapAfterShiftClose()
      ui.toastSuccess('Смена закрыта')
    } catch (e) {
      if (e.status === 409) {
        const unpaid = useOrderStore
          .getState()
          .orders.filter((o) => !o.is_paid && o.shift_id === cur.id)
        const n = unpaid.length
        const word =
          n === 1
            ? 'неоплаченный заказ'
            : n >= 2 && n <= 4
              ? 'неоплаченных заказа'
              : 'неоплаченных заказов'

        if (n === 0) {
          ui.toastError(e.message || 'Не удалось закрыть смену')
          setClosing(false)
          return
        }

        const ok = await ui.confirm({
          title: 'Есть неоплаченные заказы',
          message: `В смене ${n} ${word}. Закрыть смену и оплатить их без чаевых?`,
          confirmText: 'Оплатить все и закрыть',
          cancelText: 'Отмена',
        })
        if (!ok) {
          setClosing(false)
          return
        }

        try {
          await shift.close(cur.id, { force: true })
          await syncMapAfterShiftClose()
          ui.toastSuccess(n > 0 ? `Оплачено ${n}, смена закрыта` : 'Смена закрыта')
        } catch (e2) {
          ui.toastError(e2.message)
        }
      } else {
        ui.toastError(e.message)
      }
    } finally {
      setClosing(false)
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

  return (
    <div className="page">
      <header className="sh-header">
        <h1 className="sh-title">Смены</h1>
        {currentTitle && <span className="sh-subtitle">{currentTitle}</span>}
      </header>

      {!currentId ? (
        <div className="empty-screen">
          <p>Выберите заведение в Профиле</p>
        </div>
      ) : (
        <>
          <section className="sh-section">
            {current ? (
              <CurrentShiftCard
                shift={current}
                closing={closing}
                onClose={onCloseShift}
              />
            ) : (
              <OpenShiftButton opening={opening} onOpen={onOpenShift} />
            )}
          </section>

          <section className="sh-section">
            <h2 className="sh-section-title">История смен</h2>

            {history.length === 0 && !isLoadingHistory ? (
              <div className="sh-empty">
                <p className="empty-text">Закрытых смен пока нет</p>
              </div>
            ) : (
              <div className="sh-history-list">
                {history.map((s) => (
                  <ShiftHistoryItem key={s.id} shift={s} onOpen={setDetailsShift} />
                ))}
              </div>
            )}

            {historyHasMore && !isLoadingHistory && (
              <button className="sh-more" onClick={loadMore}>
                Показать ещё
              </button>
            )}

            {isLoadingHistory && (
              <div className="sh-loading">
                <div className="sh-spinner-small" />
              </div>
            )}
          </section>
        </>
      )}

      {detailsShift && (
        <ShiftDetailsModal
          shift={detailsShift}
          onClose={() => setDetailsShift(null)}
        />
      )}
    </div>
  )
}