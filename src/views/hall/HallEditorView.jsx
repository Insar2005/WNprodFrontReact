import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useHallStore } from '@/stores/hall'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { useUiStore } from '@/stores/ui'
import { useUndoStack } from '@/hooks/useUndoStack'
import { newId } from '@/utils/nanoid'
import { pluralize } from '@/utils/pluralize'
import HallEditorCanvas from './HallEditorCanvas'
import { edClamp, ED_SNAP } from '@/utils/hallGeometry'
import TableEditPanel from './TableEditPanel'
import HallLayoutsPanel from './HallLayoutsPanel'
import HallFormModal from './HallFormModal'
import {
  BackIcon,
  ImportIcon,
  UndoIcon,
  RedoIcon,
  PencilIcon,
  StackIcon,
  PlusIcon,
} from '@/components/menu/menuIcons'
import '@/styles/map-editor.css'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'
/**
 * Редактор карты — 1:1 EdEditorScreen из прототипа waiter-note-map-editor
 * (map-redesign/editor-screen.jsx). Полноэкранный роут.
 *
 *   • Топбар: «‹» · «Редактор карты» + «{зал} · N столов» · импорт ⤓ ·
 *     undo ↶ / redo ↷ (хоткеи Ctrl+Z / Ctrl+Shift+Z сохранены).
 *   • Табы залов: колонка — пилюля, у активной под ней мини-кнопки ✎
 *     (настройки зала) и ⧉ (шаблоны); в конце пунктирная «＋ Зал».
 *   • Канвас: 1:1 с Картой (dot-grid, рамка зала, зум с процентом);
 *     drag со снапом 8 и clamp; выделение с угловыми ручками; FAB
 *     «＋ Стол» внутри канваса (создаёт в центре видимой области,
 *     пульс 2 c, сразу выделен).
 *   • Панель стола (TableEditPanel) — контролы прототипа, механика
 *     прежняя: live patchTableLocal + один PATCH и undo-операция при
 *     закрытии.
 *
 * Unchanged (do not regress): операционный undo-стек 50 (реальные
 * API-вызовы), защита удаления стола с активным заказом, умное применение
 * шаблонов (HallLayoutsPanel), импорт по коду (/import).
 */
export default function HallEditorView() {
  const navigate = useNavigate()
  const undoStack = useUndoStack({ limit: 50 })

  const currentId = useWorkplaceStore((s) => s.currentId)
  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)
  const activeHallId = useHallStore((s) => s.activeHallId)

  const canvasApi = useRef(null)
  const pulseTimer = useRef(null)
  const dragPrev = useRef(null)
  const [editingTableId, setEditingTableId] = useState(null)
  const [pulseId, setPulseId] = useState(null)
  const [layoutsOpen, setLayoutsOpen] = useState(false)
  const [hallForm, setHallForm] = useState(null) // null | {initial}

  const sortedHalls = useMemo(
    () => [...halls].sort((a, b) => a.position - b.position),
    [halls],
  )
  const activeHall = useMemo(
    () => halls.find((h) => h.id === activeHallId) ?? sortedHalls[0] ?? null,
    [halls, activeHallId, sortedHalls],
  )
  const hallTables = useMemo(
    () => (activeHall ? tables.filter((t) => t.hall_id === activeHall.id) : []),
    [tables, activeHall],
  )
  const editingTable = editingTableId
    ? hallTables.find((t) => t.id === editingTableId) || null
    : null
  const takenNumbers = useMemo(
    () => hallTables.filter((t) => t.id !== editingTableId).map((t) => t.number),
    [hallTables, editingTableId],
  )

  // Хоткеи undo/redo (Ctrl/Cmd+Z, +Shift — redo).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) undoStack.redo()
        else undoStack.undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undoStack])

  const pulse = (id) => {
    setPulseId(id)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulseId(null), 2100)
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/map')
  }
  useTelegramBackButton(goBack)
  /* ── столы ── */

  // drag: live двигает patchTableLocal (в канвасе), конец — PATCH + undo
  const onDragStart = (id) => {
    const t = useHallStore.getState().tableById(id)
    dragPrev.current = t ? { x: t.x, y: t.y } : null
  }
  const onMoveLive = (id, x, y) => {
    useHallStore.getState().patchTableLocal(id, { x, y })
  }
  const onDragEnd = async ({ id, x, y }) => {
    const prev = dragPrev.current
    dragPrev.current = null
    if (!prev || (prev.x === x && prev.y === y)) return
    try {
      await useHallStore.getState().updateTable(id, { x, y })
      undoStack.push({
        label: 'Переместить стол',
        undo: async () => {
          await useHallStore.getState().updateTable(id, { x: prev.x, y: prev.y })
        },
        redo: async () => {
          await useHallStore.getState().updateTable(id, { x, y })
        },
      })
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  // закрытие панели: один суммарный PATCH + undo-операция
  const onCommitPanel = async (tableId, patch, snapshot) => {
    try {
      await useHallStore.getState().updateTable(tableId, patch)
      const undoPatch = {}
      for (const key of Object.keys(patch)) undoPatch[key] = snapshot[key]
      undoStack.push({
        label: 'Изменить стол',
        undo: async () => {
          await useHallStore.getState().updateTable(tableId, undoPatch)
        },
        redo: async () => {
          await useHallStore.getState().updateTable(tableId, patch)
        },
      })
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  const onDeleteFromPanel = async (tableId, snapshot) => {
    setEditingTableId(null)
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()

    if (useShiftStore.getState().current) {
      const activeOrder = useOrderStore.getState().orderByTable(tableId)
      if (activeOrder) {
        const ok = await ui.confirm({
          title: 'Удалить стол с активным заказом?',
          message:
            'На этом столе есть незакрытый заказ. Если удалить стол, заказ ' +
            'останется в смене, но без привязки к столу — его нужно будет ' +
            'переназначить вручную.',
          confirmText: 'Удалить',
          cancelText: 'Отмена',
          danger: true,
        })
        if (!ok) {
          setEditingTableId(tableId)
          return
        }
      }
    } else {
      const ok = await ui.confirm({
        title: `Удалить стол №${snapshot.number}?`,
        message: 'Стол будет убран с карты зала.',
        confirmText: 'Удалить',
        danger: true,
      })
      if (!ok) {
        setEditingTableId(tableId)
        return
      }
    }

    try {
      await hall.removeTable(tableId)
      undoStack.push({
        label: 'Удалить стол',
        undo: async () => {
          await useHallStore.getState().createTable(snapshot.hall_id, {
            id: snapshot.id,
            number: snapshot.number,
            x: snapshot.x,
            y: snapshot.y,
            width: snapshot.width,
            height: snapshot.height,
            rotation: snapshot.rotation,
            border_radius: snapshot.border_radius,
          })
        },
        redo: async () => {
          await useHallStore.getState().removeTable(snapshot.id)
        },
      })
      ui.toastSuccess('Стол удалён')
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  const onDuplicateFromPanel = async (snapshot) => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    const existing = hall.tablesOfHall(snapshot.hall_id).map((t) => t.number)
    let nextNum = 1
    while (existing.includes(nextNum)) nextNum++
    const id = newId()
    const base = {
      id,
      number: nextNum,
      x: snapshot.x + ED_SNAP * 2,
      y: snapshot.y + ED_SNAP * 2,
      width: snapshot.width,
      height: snapshot.height,
      rotation: snapshot.rotation,
      border_radius: snapshot.border_radius,
    }
    const hallObj = hall.halls.find((h) => h.id === snapshot.hall_id)
    const body = hallObj ? { ...base, ...edClamp({ ...base }, hallObj) } : base
    try {
      await hall.createTable(snapshot.hall_id, body)
      undoStack.push({
        label: 'Дублировать стол',
        undo: async () => {
          await useHallStore.getState().removeTable(id)
        },
        redo: async () => {
          await useHallStore.getState().createTable(snapshot.hall_id, body)
        },
      })
      setEditingTableId(id)
      pulse(id)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  // FAB «＋ Стол»: 56×56 в центре видимой области, снап, пульс, выделение
  const addTable = async () => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    if (!activeHall) return
    const existing = hall.tablesOfHall(activeHall.id).map((t) => t.number)
    let nextNum = 1
    while (existing.includes(nextNum)) nextNum++
    const c = canvasApi.current?.center() || {
      x: activeHall.width / 2,
      y: activeHall.height / 2,
    }
    const id = newId()
    const raw = {
      number: nextNum,
      x: Math.round((c.x - 28) / ED_SNAP) * ED_SNAP,
      y: Math.round((c.y - 28) / ED_SNAP) * ED_SNAP,
      width: 56,
      height: 56,
      rotation: 0,
      border_radius: 12,
    }
    const pos = edClamp(raw, activeHall)
    const body = { id, ...raw, x: pos.x, y: pos.y }
    try {
      await hall.createTable(activeHall.id, body)
      undoStack.push({
        label: 'Создать стол',
        undo: async () => {
          await useHallStore.getState().removeTable(id)
        },
        redo: async () => {
          await useHallStore.getState().createTable(activeHall.id, body)
        },
      })
      setEditingTableId(id)
      pulse(id)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  /* ── шаблоны ── */
  const openLayouts = async () => {
    const hall = useHallStore.getState()
    if (!hall.activeHallId) return
    setLayoutsOpen(true)
    try {
      await hall.fetchLayouts(hall.activeHallId)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }
  const onLayoutApplied = ({ moved, created }) => {
    const all = [...(moved || []), ...(created || [])]
    if (all.length > 0) pulse(all[0])
  }

  const tablesCountLabel = activeHall
    ? `${activeHall.name} · ${hallTables.length} ${pluralize(hallTables.length, ['стол', 'стола', 'столов'])}`
    : 'Нет залов'

  return (
    <div className="page ed2-page">
      <header className="ed2-topbar">
        {/* <button type="button" className="ed2-back" onClick={goBack} aria-label="Назад">
          <BackIcon width={20} height={20} />
        </button> */}
        <div className="ed2-topbar-main">
          <h1 className="ed2-title">Редактор карты</h1>
          <div className="ed2-sub">{tablesCountLabel}</div>
        </div>
        <button
          type="button"
          className="ed2-icon-btn"
          aria-label="Импорт по коду"
          onClick={() => navigate('/import')}
        >
          <ImportIcon width={18} height={18} />
        </button>
        <button
          type="button"
          className="ed2-icon-btn"
          aria-label="Отменить"
          disabled={!undoStack.canUndo}
          onClick={() => undoStack.undo()}
        >
          <UndoIcon width={18} height={18} />
        </button>
        <button
          type="button"
          className="ed2-icon-btn"
          aria-label="Повторить"
          disabled={!undoStack.canRedo}
          onClick={() => undoStack.redo()}
        >
          <RedoIcon width={18} height={18} />
        </button>
      </header>

      {!currentId ? (
        <div className="mp-nohalls-wrap">
          <div className="mp-nohalls">
            <div className="mp-nohalls-title">Выберите заведение</div>
            <div className="mp-nohalls-text">Заведение выбирается в Профиле</div>
          </div>
        </div>
      ) : halls.length === 0 ? (
        <div className="mp-nohalls-wrap">
          <div className="mp-nohalls">
            <div className="mp-nohalls-title">Залов пока нет</div>
            <div className="mp-nohalls-text">
              Создайте первый зал, чтобы расставлять столы
            </div>
            <button
              type="button"
              className="mp-nohalls-btn"
              onClick={() => setHallForm({ initial: null })}
            >
              <PlusIcon width={16} height={16} /> Создать зал
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ed2-tabs">
            {sortedHalls.map((h) => {
              const on = activeHall && h.id === activeHall.id
              return (
                <div key={h.id} className="ed2-tab-col">
                  <button
                    type="button"
                    className={`mp-tab${on ? ' mp-tab--on' : ''}`}
                    onClick={() => {
                      useHallStore.getState().setActiveHall(h.id)
                      setEditingTableId(null)
                    }}
                  >
                    {h.name}
                  </button>
                  {on && (
                    <div className="ed2-tab-mini-row">
                      <button
                        type="button"
                        className="ed2-mini"
                        aria-label="Настройки зала"
                        onClick={() => setHallForm({ initial: h })}
                      >
                        <PencilIcon width={15} height={15} />
                      </button>
                      <button
                        type="button"
                        className="ed2-mini"
                        aria-label="Шаблоны зала"
                        onClick={openLayouts}
                      >
                        <StackIcon width={15} height={15} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              className="mp-tab mp-tab--ghost"
              onClick={() => setHallForm({ initial: null })}
            >
              <PlusIcon width={14} height={14} /> Зал
            </button>
          </div>

          {activeHall && (
            <HallEditorCanvas
              hall={activeHall}
              tables={hallTables}
              selectedId={editingTableId}
              pulseId={pulseId}
              controlsHidden={!!editingTable}
              apiRef={canvasApi}
              onSelect={setEditingTableId}
              onDragStart={onDragStart}
              onMoveLive={onMoveLive}
              onDragEnd={onDragEnd}
            >
              {!editingTable && (
                <button type="button" className="ed2-fab" onClick={addTable}>
                  <PlusIcon width={16} height={16} /> Стол
                </button>
              )}
            </HallEditorCanvas>
          )}
          <div className="mp-canvas-spacer" aria-hidden />
        </>
      )}

      {editingTable && (
        <TableEditPanel
          key={editingTable.id}
          table={editingTable}
          takenNumbers={takenNumbers}
          onClose={() => setEditingTableId(null)}
          onCommit={onCommitPanel}
          onDelete={onDeleteFromPanel}
          onDuplicate={onDuplicateFromPanel}
        />
      )}

      {layoutsOpen && (
        <HallLayoutsPanel
          onClose={() => setLayoutsOpen(false)}
          onApplied={onLayoutApplied}
        />
      )}

      {hallForm && (
        <HallFormModal
          initial={hallForm.initial}
          onClose={() => setHallForm(null)}
          onSaved={() => setHallForm(null)}
        />
      )}
    </div>
  )
}