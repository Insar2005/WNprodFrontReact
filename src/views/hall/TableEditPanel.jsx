import { useEffect, useRef, useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'

/**
 * Live table editor. (Was TableEditPanel.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - reactive(localTable) → useState object. The Vue `watch(table.id)` that
 *   re-seeds local state on a different table is replaced by a
 *   key={table.id} remount at the call site (HallEditorView), so this
 *   component always initializes fresh — no setState-in-effect.
 * - The deep `watch(localTable)` that patches hall.patchTableLocal on every
 *   tweak → a useEffect on the form fields (writes to the store, an external
 *   system — the allowed kind of effect).
 * - roundnessPercent is derived; setRoundness writes border_radius.
 * - onClose computes the diff vs the initial snapshot and emits commit.
 * - $emit('close'|'commit'|'delete'|'duplicate') → callback props.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function TableEditPanel({
  visible = false,
  table = null,
  onClose,
  onCommit,
  onDelete,
  onDuplicate,
}) {
  const [busy] = useState(false)

  const initialSnapshot = useRef(
    table
      ? {
          number: table.number,
          width: table.width,
          height: table.height,
          rotation: table.rotation || 0,
          border_radius: table.border_radius ?? 16,
        }
      : null,
  )

  const [form, setForm] = useState(() =>
    table
      ? {
          number: table.number,
          width: table.width,
          height: table.height,
          rotation: table.rotation || 0,
          border_radius: table.border_radius ?? 16,
        }
      : { number: 1, width: 100, height: 100, rotation: 0, border_radius: 16 },
  )
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Live-patch the hall store on every form change so the canvas updates.
  const tableId = table?.id
  useEffect(() => {
    if (!tableId) return
    useHallStore.getState().patchTableLocal(tableId, {
      number: form.number,
      width: form.width,
      height: form.height,
      rotation: form.rotation,
      border_radius: form.border_radius,
    })
  }, [tableId, form.number, form.width, form.height, form.rotation, form.border_radius])

  const minSide = Math.min(form.width, form.height)
  const roundnessPercent =
    minSide > 0 ? Math.round((form.border_radius / (minSide / 2)) * 100) : 0

  const setRoundness = (percent) => {
    const clamped = Math.max(0, Math.min(100, percent))
    setField('border_radius', Math.round((minSide / 2) * (clamped / 100)))
  }

  const formatRotation = (deg) => `${deg > 0 ? '+' : ''}${deg}°`

  const computePatch = () => {
    const snap = initialSnapshot.current
    const patch = {}
    if (!snap) return patch
    for (const key of Object.keys(form)) {
      if (form[key] !== snap[key]) patch[key] = form[key]
    }
    return patch
  }

  const handleClose = () => {
    if (!table || !initialSnapshot.current) {
      onClose?.()
      return
    }
    const patch = computePatch()
    if (Object.keys(patch).length > 0) {
      onCommit?.(table.id, patch, { ...initialSnapshot.current })
    }
    onClose?.()
  }

  const handleDelete = async () => {
    if (!table) return
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: `Удалить стол №${form.number}?`,
      message: 'Действие можно отменить кнопкой ↶',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    // Restore original values in store before delete so undo re-creates the
    // table with the pre-edit values, not this session's half-edits.
    if (initialSnapshot.current) {
      useHallStore.getState().patchTableLocal(table.id, initialSnapshot.current)
    }
    onDelete?.(table.id, table)
    onClose?.()
  }

  const handleDuplicate = () => {
    if (!table) return
    const patch = computePatch()
    if (Object.keys(patch).length > 0) {
      onCommit?.(table.id, patch, { ...initialSnapshot.current })
    }
    const snapshot = {
      hall_id: table.hall_id,
      width: form.width,
      height: form.height,
      rotation: form.rotation,
      border_radius: form.border_radius,
      x: table.x,
      y: table.y,
    }
    onDuplicate?.(snapshot)
    onClose?.()
  }

  const header = (
    <div className="tep-header">
      <h3 className="tep-title">
        <span>Стол №</span>
        <input
          className="tep-num-input"
          type="number"
          min="1"
          aria-label="Номер стола"
          value={form.number}
          onChange={(e) => setField('number', Number(e.target.value) || 1)}
        />
      </h3>
      <button className="tep-close" onClick={handleClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  )

  const footer = (
    <div className="tep-footer">
      <button className="btn btn--danger" onClick={handleDelete} disabled={busy}>
        🗑 Удалить
      </button>
      <button className="btn btn--ghost" onClick={handleDuplicate} disabled={busy}>
        📋 Копия
      </button>
      <button className="btn btn--primary" onClick={handleClose} disabled={busy}>
        Готово
      </button>
    </div>
  )

  return (
    <BottomSheet
      visible={visible}
      snapPoints={[280, 0.55]}
      initialSnap={0}
      header={header}
      footer={footer}
    >
      <div className="tep-form">
        <div className="tep-field">
          <div className="tep-field-row">
            <span className="tep-label">Ширина</span>
            <span className="tep-value">{form.width} px</span>
          </div>
          <input
            type="range"
            min={40}
            max={300}
            step={10}
            className="tep-slider"
            value={form.width}
            onChange={(e) => setField('width', Number(e.target.value))}
          />
        </div>

        <div className="tep-field">
          <div className="tep-field-row">
            <span className="tep-label">Высота</span>
            <span className="tep-value">{form.height} px</span>
          </div>
          <input
            type="range"
            min={40}
            max={300}
            step={10}
            className="tep-slider"
            value={form.height}
            onChange={(e) => setField('height', Number(e.target.value))}
          />
        </div>

        <div className="tep-field">
          <div className="tep-field-row">
            <span className="tep-label">Форма</span>
            <span className="tep-value">{roundnessPercent}%</span>
          </div>
          <div className="tep-presets">
            <button
              type="button"
              className={
                roundnessPercent === 0 ? 'tep-preset tep-preset--active' : 'tep-preset'
              }
              onClick={() => setRoundness(0)}
            >
              <span className="tep-preset-icon" style={{ borderRadius: 0 }} />
              <span>Прямоугольник</span>
            </button>
            <button
              type="button"
              className={
                roundnessPercent === 100 ? 'tep-preset tep-preset--active' : 'tep-preset'
              }
              onClick={() => setRoundness(100)}
            >
              <span className="tep-preset-icon" style={{ borderRadius: '50%' }} />
              <span>Овал/Круг</span>
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            className="tep-slider"
            value={roundnessPercent}
            onChange={(e) => setRoundness(Number(e.target.value))}
          />
        </div>

        <div className="tep-field">
          <div className="tep-field-row">
            <span className="tep-label">Поворот</span>
            <span className="tep-value">{formatRotation(form.rotation)}</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            className="tep-slider"
            value={form.rotation}
            onChange={(e) => setField('rotation', Number(e.target.value))}
          />
          {form.rotation !== 0 && (
            <button
              type="button"
              className="tep-reset-link"
              onClick={() => setField('rotation', 0)}
            >
              Сбросить поворот
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}