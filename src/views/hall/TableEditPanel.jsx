import { useEffect, useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { TrashIcon } from '@/components/menu/menuIcons'

/**
 * Панель стола — 1:1 EdTablePanel из прототипа (map-redesign/editor-ui.jsx):
 * низ-шит ≤48% (канвас виден), № — инпут 72×40 с проверкой конфликта,
 * Ширина/Высота — слайдеры 32–220 шаг 4 с сохранением центра, Форма —
 * пресеты Прямоугольник/Овал + слайдер скругления 0–100% шаг 5 (% от
 * min(w,h)/2), Поворот — слайдер −180…180° шаг 5 + «Сбросить», футер
 * Удалить/Дублировать/Готово.
 *
 * Механика прежняя (не регрессировать): live-правки пишутся в стор через
 * patchTableLocal (канвас обновляется мгновенно), а при закрытии считается
 * один суммарный patch → onCommit(id, patch, snapshot) — родитель делает
 * PATCH на бэк и кладёт операцию в undo-стек.
 */
/* строка-слайдер: label · range · значение (EdSlideRow из прототипа) */
function Slide({ label, value, display, min, max, step, onChange }) {
  return (
    <div className="ed2-slide-row">
      <span className="ed2-slide-label">{label}</span>
      <input
        type="range"
        className="ed2-slide"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ed2-slide-val">{display}</span>
    </div>
  )
}

export default function TableEditPanel({
  table,
  takenNumbers = [],
  onClose,
  onCommit,
  onDelete,
  onDuplicate,
}) {
  // Снапшот исходных значений — фиксируется на маунте (родитель ремаунтит
  // панель по key=table.id), из него считается итоговый patch и undo.
  const [snapshot] = useState(() =>
    table
      ? {
          number: table.number,
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          rotation: table.rotation || 0,
          border_radius: table.border_radius ?? 16,
        }
      : null,
  )
  const [form, setForm] = useState(() =>
    snapshot || { number: 1, x: 0, y: 0, width: 100, height: 100, rotation: 0, border_radius: 16 },
  )
  const [numDraft, setNumDraft] = useState(String(form.number))
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // Live-patch стора на каждое движение — канвас обновляется живьём.
  const tableId = table?.id
  useEffect(() => {
    if (!tableId) return
    useHallStore.getState().patchTableLocal(tableId, {
      number: form.number,
      x: form.x,
      y: form.y,
      width: form.width,
      height: form.height,
      rotation: form.rotation,
      border_radius: form.border_radius,
    })
  }, [tableId, form])

  const num = parseInt(numDraft, 10)
  const conflict =
    !Number.isNaN(num) && num !== snapshot?.number
      ? takenNumbers.includes(num)
      : false
  const invalid = Number.isNaN(num) || conflict
  const changeNum = (v) => {
    setNumDraft(v)
    const n = parseInt(v, 10)
    if (!Number.isNaN(n) && !takenNumbers.includes(n)) setField('number', n)
  }

  const minSide = Math.min(form.width, form.height)
  const pct =
    minSide > 0
      ? Math.round(((form.border_radius / (minSide / 2)) * 100) / 5) * 5
      : 0
  const setPct = (p) => {
    const clamped = Math.max(0, Math.min(100, p))
    setField('border_radius', Math.round((minSide / 2) * (clamped / 100)))
  }

  // Слайдеры W/H сохраняют центр стола и не дают br вылезти за min/2.
  const setW = (v) =>
    setForm((f) => ({
      ...f,
      width: v,
      x: Math.round(f.x + (f.width - v) / 2),
      border_radius: Math.min(f.border_radius, Math.min(v, f.height) / 2),
    }))
  const setH = (v) =>
    setForm((f) => ({
      ...f,
      height: v,
      y: Math.round(f.y + (f.height - v) / 2),
      border_radius: Math.min(f.border_radius, Math.min(f.width, v) / 2),
    }))

  const computePatch = () => {
    const patch = {}
    if (!snapshot) return patch
    for (const key of Object.keys(form)) {
      if (form[key] !== snapshot[key]) patch[key] = form[key]
    }
    return patch
  }
  const handleClose = () => {
    if (table && snapshot) {
      const patch = computePatch()
      if (Object.keys(patch).length > 0) {
        onCommit?.(table.id, patch, { ...snapshot, id: table.id, hall_id: table.hall_id })
      }
    }
    onClose?.()
  }

  if (!table) return null

  return (
    <div className="ed2-panel">
      <div className="ed2-panel-handle" aria-hidden />
      <div className="ed2-panel-head">
        <span className="ed2-panel-title">Стол №</span>
        <input
          className={`ed2-num-input${invalid ? ' ed2-num-input--bad' : ''}`}
          inputMode="numeric"
          value={numDraft}
          aria-label="Номер стола"
          onChange={(e) => changeNum(e.target.value.replace(/[^\d]/g, ''))}
        />
        {conflict && <span className="ed2-num-conflict">№ уже занят</span>}
        <span className="ed2-panel-spacer" />
        <button type="button" className="ed2-panel-close" onClick={handleClose} aria-label="Закрыть">
          ×
        </button>
      </div>

      <div className="ed2-panel-body">
        <Slide label="Ширина" value={form.width} display={form.width} min={32} max={220} step={4} onChange={setW} />
        <Slide label="Высота" value={form.height} display={form.height} min={32} max={220} step={4} onChange={setH} />

        {/* <div className="ed2-row-head">
          <span className="ed2-lbl">Форма</span>
          <span className="ed2-val">{pct}%</span>
        </div>
        <div className="ed2-tiles">
          <button type="button" className={`ed2-tile${pct === 0 ? ' ed2-tile--on' : ''}`} onClick={() => setPct(0)}>
            <span className="ed2-tile-rect" aria-hidden /> Прямоугольник
          </button>
          <button type="button" className={`ed2-tile${pct === 100 ? ' ed2-tile--on' : ''}`} onClick={() => setPct(100)}>
            <span className="ed2-tile-circle" aria-hidden /> Овал / Круг
          </button>
        </div> */}
        <Slide label="Скругление" value={pct} display={`${pct}%`} min={0} max={100} step={5} onChange={setPct} />

        <div className="ed2-row-head" style={{ margin: '8px 0 0' }}>
          <span className="ed2-lbl">Поворот</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            {form.rotation !== 0 && (
              <button type="button" className="ed2-reset" onClick={() => setField('rotation', 0)}>
                Сбросить
              </button>
            )}
            <span className="ed2-val">{form.rotation}°</span>
          </span>
        </div>
        <Slide label="Угол" value={form.rotation} display={`${form.rotation}°`} min={-180} max={180} step={5} onChange={(v) => setField('rotation', v)} />

        <div className="ed2-actions">
          <button type="button" className="ed2-act ed2-act--danger" onClick={() => onDelete?.(table.id, { ...table })}>
            <TrashIcon width={16} height={16} /> Удалить
          </button>
          <button type="button" className="ed2-act" onClick={() => onDuplicate?.({ ...table })}>
            Дублировать
          </button>
          <button type="button" className="ed2-act ed2-act--primary" onClick={handleClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}