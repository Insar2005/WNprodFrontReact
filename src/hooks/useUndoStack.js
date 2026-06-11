import { useCallback, useRef, useState } from 'react'

/**
 * Generic undo/redo stack for editor screens. React port of the Vue
 * useUndoStack composable.
 *
 * Each op is { label, undo, redo } (undo/redo may be async, awaited).
 * push() records an already-performed action's inverse; it does NOT call
 * redo. Limit (default 50) caps memory.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - The stacks live in refs (we mutate them imperatively in undo/redo and
 *   don't want stale closures), while canUndo/canRedo are React STATE so
 *   the toolbar buttons re-render enable/disable. We recompute those flags
 *   after every mutation via syncFlags().
 * - push/undo/redo/clear are useCallback-stable so consumers can depend on
 *   them without re-subscribing.
 * ─────────────────────────────────────────────────────────────────────
 */
export function useUndoStack({ limit = 50 } = {}) {
  const undoStack = useRef([])
  const redoStack = useRef([])
  const applyingRef = useRef(false)

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0 && !applyingRef.current)
    setCanRedo(redoStack.current.length > 0 && !applyingRef.current)
  }, [])

  const push = useCallback(
    (op) => {
      undoStack.current.push(op)
      if (undoStack.current.length > limit) undoStack.current.shift()
      redoStack.current = []
      syncFlags()
    },
    [limit, syncFlags],
  )

  const undo = useCallback(async () => {
    if (undoStack.current.length === 0 || applyingRef.current) return
    const op = undoStack.current.pop()
    applyingRef.current = true
    syncFlags()
    try {
      await op.undo()
      redoStack.current.push(op)
    } catch (e) {
      undoStack.current.push(op)
      throw e
    } finally {
      applyingRef.current = false
      syncFlags()
    }
  }, [syncFlags])

  const redo = useCallback(async () => {
    if (redoStack.current.length === 0 || applyingRef.current) return
    const op = redoStack.current.pop()
    applyingRef.current = true
    syncFlags()
    try {
      await op.redo()
      undoStack.current.push(op)
    } catch (e) {
      redoStack.current.push(op)
      throw e
    } finally {
      applyingRef.current = false
      syncFlags()
    }
  }, [syncFlags])

  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    syncFlags()
  }, [syncFlags])

  return { canUndo, canRedo, push, undo, redo, clear }
}