import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { useUndoStack } from '@/hooks/useUndoStack'
import { newId } from '@/utils/nanoid'
import HallEditorCanvas from './HallEditorCanvas'
import HallFormModal from './HallFormModal'
import TableEditPanel from './TableEditPanel'
import HallLayoutsPanel from './HallLayoutsPanel'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

/**
 * Hall editor. (Was HallEditorView.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - hall getters are methods → subscribe to raw halls/tables/activeHallId,
 *   derive sortedHalls/activeHall/tablesOfActive via useMemo.
 * - undoStack ops carry undo/redo closures; every mutating handler pushes
 *   the inverse. The hook's canUndo/canRedo are state → toolbar re-renders.
 * - editingTableId drives the TableEditPanel; we pass key={editingTableId}
 *   so the panel re-seeds its form on a different table (no setState-in-
 *   effect).
 * - pulseTableId via useState + a timer ref; nextTick → requestAnimationFrame.
 * - keyboard Ctrl/Cmd+Z / +Shift+Z (or +Y) → window keydown listener.
 * - route handle {hideBottomNav:true} set in the router.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function HallEditorView() {
  const navigate = useNavigate()
  const undoStack = useUndoStack({ limit: 50 })

  const currentId = useWorkplaceStore((s) => s.currentId)
  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)
  const activeHallId = useHallStore((s) => s.activeHallId)

  const canvasRef = useRef(null)
  const pulseTimer = useRef(null)

  const [editingTableId, setEditingTableId] = useState(null)
  const [hallFormVisible, setHallFormVisible] = useState(false)
  const [editingHall, setEditingHall] = useState(null)
  const [layoutsPanelVisible, setLayoutsPanelVisible] = useState(false)
  const [pulseTableId, setPulseTableId] = useState(null)

  const sortedHalls = useMemo(
    () => [...halls].sort((a, b) => a.position - b.position),
    [halls],
  )
  const activeHall = useMemo(
    () => halls.find((h) => h.id === activeHallId) ?? null,
    [halls, activeHallId],
  )
  const tablesOfActive = useMemo(
    () => tables.filter((t) => t.hall_id === activeHallId),
    [tables, activeHallId],
  )
  const isEmpty = halls.length === 0
  const editingTablePanel = useMemo(
    () => (editingTableId ? tables.find((t) => t.id === editingTableId) ?? null : null),
    [editingTableId, tables],
  )

  const pulse = (id) => {
    setPulseTableId(id)
    clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => {
      setPulseTableId((cur) => (cur === id ? null : cur))
    }, 2000)
  }

  // === Navigation ===
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/map')
  
  }
  useTelegramBackButton(goBack)
  const goToImport = () => navigate('/import')

  // === Hall form ===
  const openHallCreate = () => {
    setEditingHall(null)
    setHallFormVisible(true)
  }
  const openHallEdit = (h) => {
    setEditingHall(h)
    setHallFormVisible(true)
  }
  const closeHallForm = () => {
    setHallFormVisible(false)
    setEditingHall(null)
  }

  // === Layouts ===
  const openLayouts = async () => {
    const hall = useHallStore.getState()
    if (!hall.activeHallId) return
    setLayoutsPanelVisible(true)
    try {
      await hall.fetchLayouts(hall.activeHallId)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  const onLayoutApplied = ({ moved, created }) => {
    const all = [...(moved || []), ...(created || [])]
    if (all.length === 0) return
    const firstId = all[0]
    requestAnimationFrame(() => canvasRef.current?.centerOnTable(firstId))
    pulse(firstId)
  }

  // === Table creation (one-tap) ===
  const openTableCreate = async () => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    const active = hall.activeHall()
    if (!active) return

    const existing = hall.tablesOfHall(hall.activeHallId).map((t) => t.number)
    let nextNum = 1
    while (existing.includes(nextNum)) nextNum++

    const center = canvasRef.current?.getViewportCenter?.() || { x: 0, y: 0 }
    const w = 100
    const h = 100
    let x = Math.round(center.x - w / 2)
    let y = Math.round(center.y - h / 2)
    x = Math.max(0, Math.min(x, active.width - w))
    y = Math.max(0, Math.min(y, active.height - h))

    const id = newId()
    const hallId = hall.activeHallId
    const body = {
      id,
      number: nextNum,
      x,
      y,
      width: w,
      height: h,
      rotation: 0,
      border_radius: 16,
    }
    try {
      await hall.createTable(hallId, body)
      undoStack.push({
        label: 'Создать стол',
        undo: async () => {
          await useHallStore.getState().removeTable(id)
        },
        redo: async () => {
          await useHallStore.getState().createTable(hallId, body)
        },
      })
      pulse(id)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  // === Canvas interactions ===
  const onTableTap = (tableId) => {
    if (editingTableId === tableId) {
      setEditingTableId(null)
      return
    }
    setEditingTableId(tableId)
    requestAnimationFrame(() => canvasRef.current?.centerOnTable(tableId))
  }

  const onCanvasTap = () => {
    if (editingTableId) setEditingTableId(null)
  }

  const onTableDrop = async ({ id, x, y, prevX, prevY }) => {
    const hall = useHallStore.getState()
    try {
      await hall.updateTable(id, { x, y })
      undoStack.push({
        label: 'Передвинуть стол',
        undo: async () => {
          await useHallStore.getState().updateTable(id, { x: prevX, y: prevY })
        },
        redo: async () => {
          await useHallStore.getState().updateTable(id, { x, y })
        },
      })
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  // === Edit panel callbacks ===
  const onCommitEdit = async (tableId, patch, prevSnapshot) => {
    const hall = useHallStore.getState()
    try {
      await hall.updateTable(tableId, patch)
      const undoPatch = {}
      for (const key of Object.keys(patch)) undoPatch[key] = prevSnapshot[key]
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

  const onCloseEditPanel = () => setEditingTableId(null)

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
    setEditingTableId(null)
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()

    const existing = hall.tablesOfHall(snapshot.hall_id).map((t) => t.number)
    let nextNum = 1
    while (existing.includes(nextNum)) nextNum++

    const active = hall.activeHall()
    const offset = 24
    let newX = snapshot.x + offset
    let newY = snapshot.y + offset
    if (active) {
      newX = Math.max(0, Math.min(newX, active.width - snapshot.width))
      newY = Math.max(0, Math.min(newY, active.height - snapshot.height))
    }

    const id = newId()
    const body = {
      id,
      number: nextNum,
      x: newX,
      y: newY,
      width: snapshot.width,
      height: snapshot.height,
      rotation: snapshot.rotation,
      border_radius: snapshot.border_radius,
    }
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
      ui.toastSuccess(`Создан стол №${nextNum}`)
      requestAnimationFrame(() => canvasRef.current?.centerOnTable(id))
      pulse(id)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  // === Undo/Redo ===
  const onUndo = async () => {
    try {
      await undoStack.undo()
    } catch (e) {
      useUiStore.getState().toastError(`Не удалось отменить: ${e.message}`)
    }
  }
  const onRedo = async () => {
    try {
      await undoStack.redo()
    } catch (e) {
      useUiStore.getState().toastError(`Не удалось повторить: ${e.message}`)
    }
  }

  // Keyboard shortcuts + cleanup. undoStack.undo/redo and clear are stable.
  useEffect(() => {
    const onKey = (e) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey
      const isRedo =
        (e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      if (isUndo) {
        e.preventDefault()
        onUndo()
      } else if (isRedo) {
        e.preventDefault()
        onRedo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      undoStack.clear()
      clearTimeout(pulseTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setActiveHall = (id) => useHallStore.getState().setActiveHall(id)

  return (
    <div className="ed-page">
      <header className="ed-topbar">
        {/* <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button> */}
        <h1 className="ed-title">Карта столов</h1>
        <div className="ed-topbar-actions">
          <button className="ed-icon-btn" onClick={goToImport} title="Импортировать">
            ⤓
          </button>
          <button
            className="ed-icon-btn"
            disabled={!undoStack.canUndo}
            onClick={onUndo}
            title="Отменить (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className="ed-icon-btn"
            disabled={!undoStack.canRedo}
            onClick={onRedo}
            title="Повторить (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        </div>
      </header>

      {!currentId ? (
        <div className="ed-empty">
          <p>Выберите заведение в Профиле</p>
        </div>
      ) : (
        <>
          <div className="ed-halls-bar">
            <div className="ed-halls-tabs">
              {sortedHalls.map((h) => (
                <button
                  key={h.id}
                  className={
                    h.id === activeHallId ? 'ed-hall-tab ed-hall-tab--active' : 'ed-hall-tab'
                  }
                  onClick={() => setActiveHall(h.id)}
                >
                  {h.name}
                </button>
              ))}
              <button className="ed-hall-tab ed-hall-tab--add" onClick={openHallCreate}>
                + Зал
              </button>
            </div>
            {activeHall && (
              <>
                <button
                  className="ed-hall-edit-btn"
                  onClick={openLayouts}
                  title="Шаблоны расстановки"
                  aria-label="Шаблоны расстановки"
                >
                  📋
                </button>
                <button
                  className="ed-hall-edit-btn"
                  onClick={() => openHallEdit(activeHall)}
                  aria-label="Настройки зала"
                >
                  ⚙
                </button>
              </>
            )}
          </div>

          {isEmpty ? (
            <div className="ed-empty">
              <p className="empty-title">Залов пока нет</p>
              <p className="empty-text">Создайте первый зал, чтобы расставлять столы.</p>
              <button className="btn-primary" onClick={openHallCreate}>
                Создать зал
              </button>
            </div>
          ) : (
            <div className="ed-canvas-area">
              {activeHall && (
                <HallEditorCanvas
                  ref={canvasRef}
                  hall={activeHall}
                  tables={tablesOfActive}
                  selectedId={editingTableId}
                  pulseTableId={pulseTableId}
                  onTableTap={onTableTap}
                  onTableDrop={onTableDrop}
                  onCanvasTap={onCanvasTap}
                />
              )}
              {activeHall && !editingTableId && (
                <button className="fab" onClick={openTableCreate} aria-label="Добавить стол">
                  +
                </button>
              )}
            </div>
          )}
        </>
      )}

      {hallFormVisible && (
        <HallFormModal initial={editingHall} onClose={closeHallForm} onSaved={closeHallForm} />
      )}

      <TableEditPanel
        key={editingTableId || 'none'}
        visible={!!editingTableId}
        table={editingTablePanel}
        onClose={onCloseEditPanel}
        onCommit={onCommitEdit}
        onDelete={onDeleteFromPanel}
        onDuplicate={onDuplicateFromPanel}
      />

      <HallLayoutsPanel
        visible={layoutsPanelVisible}
        onClose={() => setLayoutsPanelVisible(false)}
        onApplied={onLayoutApplied}
      />
    </div>
  )
}