import { useEffect, useRef, useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { useOrderStore } from '@/stores/order'
import { useShiftStore } from '@/stores/shift'
import { newId } from '@/utils/nanoid'

/**
 * Create / edit a hall. (Was HallFormModal.vue.)
 * Delete warns when tables carry active orders (backend nulls table_id).
 */
export default function HallFormModal({ initial = null, onClose, onSaved }) {
  const isEdit = !!initial
  const [busy, setBusy] = useState(false)
  const nameRef = useRef(null)

  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    width: initial?.width || 1000,
    height: initial?.height || 1000,
  }))
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const r = requestAnimationFrame(() => nameRef.current?.focus())
    return () => cancelAnimationFrame(r)
  }, [])

  const onSubmit = async () => {
    if (busy) return
    const ui = useUiStore.getState()
    const hall = useHallStore.getState()
    setBusy(true)
    try {
      if (isEdit) {
        await hall.updateHall(initial.id, {
          name: form.name,
          width: form.width,
          height: form.height,
        })
        ui.toastSuccess('Сохранено')
      } else {
        const workplaceId = useWorkplaceStore.getState().currentId
        if (!workplaceId) {
          ui.toastError('Нет выбранного заведения')
          setBusy(false)
          return
        }
        await hall.createHall(workplaceId, {
          id: newId(),
          name: form.name,
          width: form.width,
          height: form.height,
          scale: 1.0,
        })
        ui.toastSuccess('Зал создан')
      }
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const hall = useHallStore.getState()
    const tables = hall.tablesOfHall(initial.id)
    const tableCount = tables.length

    let activeOrderNote = ''
    if (useShiftStore.getState().current) {
      const orderStore = useOrderStore.getState()
      const withOrders = tables.filter((t) => orderStore.orderByTable(t.id)).length
      if (withOrders > 0) {
        activeOrderNote =
          ` На ${withOrders} из них есть незакрытые заказы — они останутся в смене, но без привязки к столу.`
      }
    }

    const ok = await ui.confirm({
      title: 'Удалить зал?',
      message:
        `Зал и его ${tableCount} столов будут удалены.` + activeOrderNote,
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await hall.removeHall(initial.id)
      ui.toastSuccess('Зал удалён')
      onSaved?.()
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
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">
            {isEdit ? 'Настройки зала' : 'Новый зал'}
          </h3>
          <button className="sheet-close" onClick={() => onClose?.()} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="sheet-form">
          <label className="field">
            <span className="field-label">Название</span>
            <input
              ref={nameRef}
              className="field-input"
              type="text"
              placeholder="Например: Основной зал"
              maxLength={100}
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </label>

          <div className="mn-row">
            <label className="field mn-field-price">
              <span className="field-label">Ширина</span>
              <input
                className="field-input"
                type="number"
                min="200"
                max="5000"
                step="100"
                value={form.width}
                onChange={(e) => setField('width', Number(e.target.value) || 1000)}
              />
            </label>
            <label className="field mn-field-portion">
              <span className="field-label">Высота</span>
              <input
                className="field-input"
                type="number"
                min="200"
                max="5000"
                step="100"
                value={form.height}
                onChange={(e) => setField('height', Number(e.target.value) || 1000)}
              />
            </label>
          </div>
          <p className="hf-hint">Шаг сетки — 10px (~ 1 см).</p>

          <div className="sheet-actions">
            {isEdit && (
              <button className="btn btn--ghost-danger" disabled={busy} onClick={onDelete}>
                Удалить зал
              </button>
            )}
            <div className="sheet-actions-spacer" />
            <button className="btn btn--ghost" onClick={() => onClose?.()}>
              Отмена
            </button>
            <button className="btn btn--primary" disabled={busy} onClick={onSubmit}>
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}