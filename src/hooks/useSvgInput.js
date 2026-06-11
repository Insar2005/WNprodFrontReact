import { useEffect, useRef } from 'react'

/**
 * Pointer-events gesture handler for SVG canvases. React port of the Vue
 * useSvgInput composable.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - ALL gesture bookkeeping lives in refs (pointers Map, drag/pan/pinch
 *   state, rAF flags). None of it is React state: gestures drive callbacks
 *   (which mutate the consumer's viewBox), never re-renders here.
 * - `getViewBox` and `callbacks` are read through a ref that we keep fresh
 *   each render, so the stable handler closures always see the latest
 *   consumer state without re-subscribing.
 * - onUnmounted(maybeUnbindGlobal) → useEffect cleanup.
 * - Returns { handlePointerDownTable, handlePointerDownEmpty, clientToSvg }
 *   exactly like the composable.
 *
 * Key correctness trick (unchanged): pan/pinch math converts client-pixel
 * deltas through a viewBox SNAPSHOT captured at gesture start, never a live
 * read — so consumer mutations don't compound errors.
 * ─────────────────────────────────────────────────────────────────────
 */
const TAP_THRESHOLD = 5 // pixels

export function useSvgInput({ svgRef, getViewBox, callbacks = {} }) {
  // Keep latest getViewBox/callbacks reachable from stable closures.
  const cfg = useRef({ getViewBox, callbacks })
  cfg.current.getViewBox = getViewBox
  cfg.current.callbacks = callbacks

  // Mutable gesture state — persists across renders, never triggers one.
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = {
      pointers: new Map(),
      activeDrag: null,
      panState: null,
      pinchState: null,
      rafScheduled: false,
      pendingPanDelta: null,
      pendingDragSvg: null,
      pendingPinch: null,
      bound: false,
    }
  }

  // Build the engine once (closures capture stateRef + cfg, both stable).
  const engineRef = useRef(null)
  if (engineRef.current === null) {
    const S = stateRef.current
    const getVB = () => cfg.current.getViewBox()
    const cb = () => cfg.current.callbacks

    function clientToSvg(clientX, clientY, vb = null) {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      const box = vb || getVB()
      if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
      return {
        x: box.x + ((clientX - rect.left) / rect.width) * box.w,
        y: box.y + ((clientY - rect.top) / rect.height) * box.h,
      }
    }

    function clientDeltaToSvg(dx, dy, vb) {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 }
      return { x: (dx / rect.width) * vb.w, y: (dy / rect.height) * vb.h }
    }

    function dist(p1, p2) {
      const dx = p1.x - p2.x
      const dy = p1.y - p2.y
      return Math.sqrt(dx * dx + dy * dy)
    }

    function flushFrame() {
      S.rafScheduled = false
      const c = cb()
      if (S.pendingPanDelta && c.onPan) {
        const d = S.pendingPanDelta
        S.pendingPanDelta = null
        c.onPan(d)
      }
      if (S.activeDrag && S.pendingDragSvg && c.onTableDragMove) {
        const delta = {
          x: S.pendingDragSvg.x - S.activeDrag.startSvg.x,
          y: S.pendingDragSvg.y - S.activeDrag.startSvg.y,
        }
        c.onTableDragMove(S.activeDrag.tableId, delta, S.pendingDragSvg)
        S.pendingDragSvg = null
      }
      if (S.pendingPinch && c.onPinch) {
        c.onPinch(S.pendingPinch)
        S.pendingPinch = null
      }
    }

    function scheduleFrame() {
      if (!S.rafScheduled) {
        S.rafScheduled = true
        requestAnimationFrame(flushFrame)
      }
    }

    function startPinch() {
      const c = cb()
      if (S.activeDrag && c.onTableDragEnd) c.onTableDragEnd(S.activeDrag.tableId)
      S.activeDrag = null
      S.pendingDragSvg = null
      S.panState = null
      S.pendingPanDelta = null

      const arr = [...S.pointers.values()]
      const a = arr[0]
      const b = arr[1]
      const vbAtStart = { ...getVB() }
      const startDist = dist(a.lastClient, b.lastClient)
      const midClient = {
        x: (a.lastClient.x + b.lastClient.x) / 2,
        y: (a.lastClient.y + b.lastClient.y) / 2,
      }
      const midSvg = clientToSvg(midClient.x, midClient.y, vbAtStart)
      S.pinchState = { startDist, midSvg, vbAtStart }
    }

    function handlePointerDownTable(e, tableId) {
      e.stopPropagation()
      if (e.button !== undefined && e.button !== 0) return
      const svgPoint = clientToSvg(e.clientX, e.clientY)
      S.pointers.set(e.pointerId, {
        id: e.pointerId,
        type: 'table',
        tableId,
        startClient: { x: e.clientX, y: e.clientY },
        startSvg: svgPoint,
        lastClient: { x: e.clientX, y: e.clientY },
        moved: false,
      })
      if (S.pointers.size === 2) startPinch()
      bindGlobal()
    }

    function handlePointerDownEmpty(e) {
      if (e.button !== undefined && e.button !== 0) return
      const svgPoint = clientToSvg(e.clientX, e.clientY)
      S.pointers.set(e.pointerId, {
        id: e.pointerId,
        type: 'empty',
        startClient: { x: e.clientX, y: e.clientY },
        startSvg: svgPoint,
        lastClient: { x: e.clientX, y: e.clientY },
        moved: false,
      })
      if (S.pointers.size === 2) {
        startPinch()
      } else {
        S.panState = {
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          vbAtStart: { ...getVB() },
        }
      }
      bindGlobal()
    }

    function handlePointerMove(e) {
      const p = S.pointers.get(e.pointerId)
      if (!p) return

      // iOS WebView sometimes drops up/cancel — synthesize an up if the
      // pointer is effectively gone (no buttons / no pressure).
      if (e.buttons === 0 && e.pointerType !== 'touch') {
        handlePointerUp(e)
        return
      }

      p.lastClient = { x: e.clientX, y: e.clientY }
      const dx = p.lastClient.x - p.startClient.x
      const dy = p.lastClient.y - p.startClient.y
      if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
        p.moved = true
      }

      // PINCH
      if (S.pointers.size >= 2 && S.pinchState) {
        const arr = [...S.pointers.values()]
        const a = arr[0]
        const b = arr[1]
        const curDist = dist(a.lastClient, b.lastClient)
        if (S.pinchState.startDist > 0) {
          S.pendingPinch = {
            scale: curDist / S.pinchState.startDist,
            centerSvg: S.pinchState.midSvg,
          }
          scheduleFrame()
        }
        return
      }

      if (S.pointers.size !== 1) return
      const cur = S.pointers.values().next().value
      if (cur.id !== e.pointerId) return

      const c = cb()
      if (cur.type === 'table' && cur.moved) {
        if (c.onTableDragStart) {
          const curSvg = clientToSvg(cur.lastClient.x, cur.lastClient.y)
          if (!S.activeDrag) {
            S.activeDrag = {
              tableId: cur.tableId,
              startSvg: cur.startSvg,
              lastSvg: curSvg,
            }
            c.onTableDragStart(cur.tableId, cur.startSvg)
          }
          S.activeDrag.lastSvg = curSvg
          S.pendingDragSvg = curSvg
          scheduleFrame()
          return
        }
        // Viewer mode: retype as 'empty' so this becomes a pan.
        cur.type = 'empty'
        if (!S.panState) {
          S.panState = {
            lastClientX: cur.lastClient.x,
            lastClientY: cur.lastClient.y,
            vbAtStart: { ...getVB() },
          }
        }
      }

      if (cur.type === 'empty' && cur.moved) {
        if (!S.panState) {
          S.panState = {
            lastClientX: cur.lastClient.x,
            lastClientY: cur.lastClient.y,
            vbAtStart: { ...getVB() },
          }
          return
        }
        const dxClient = cur.lastClient.x - S.panState.lastClientX
        const dyClient = cur.lastClient.y - S.panState.lastClientY
        S.panState.lastClientX = cur.lastClient.x
        S.panState.lastClientY = cur.lastClient.y
        const deltaSvg = clientDeltaToSvg(dxClient, dyClient, S.panState.vbAtStart)
        if (S.pendingPanDelta) {
          S.pendingPanDelta.x += deltaSvg.x
          S.pendingPanDelta.y += deltaSvg.y
        } else {
          S.pendingPanDelta = deltaSvg
        }
        scheduleFrame()
      }
    }

    function handlePointerUp(e) {
      const p = S.pointers.get(e.pointerId)
      if (!p) return
      S.pointers.delete(e.pointerId)
      const c = cb()

      if (S.pinchState && S.pointers.size < 2) {
        const finalScale = S.pendingPinch?.scale ?? 1
        S.pinchState = null
        S.pendingPinch = null
        if (c.onPinchEnd) c.onPinchEnd({ scale: finalScale })

        if (S.pointers.size === 1) {
          const remaining = S.pointers.values().next().value
          remaining.startClient = { ...remaining.lastClient }
          remaining.startSvg = clientToSvg(
            remaining.lastClient.x,
            remaining.lastClient.y,
          )
          remaining.moved = true
          if (remaining.type === 'empty') {
            S.panState = {
              lastClientX: remaining.lastClient.x,
              lastClientY: remaining.lastClient.y,
              vbAtStart: { ...getVB() },
            }
          }
        }
        maybeUnbindGlobal()
        return
      }

      if (S.pointers.size === 0) {
        if (!p.moved) {
          if (p.type === 'table' && c.onTableTap) c.onTableTap(p.tableId)
          else if (p.type === 'empty' && c.onCanvasTap) c.onCanvasTap(p.startSvg)
        } else if (S.activeDrag) {
          if (c.onTableDragEnd) c.onTableDragEnd(S.activeDrag.tableId)
          S.activeDrag = null
          S.pendingDragSvg = null
        } else if (p.type === 'empty') {
          if (c.onPanEnd) c.onPanEnd()
          S.panState = null
        }
      }
      maybeUnbindGlobal()
    }

    function handlePointerCancel(e) {
      const p = S.pointers.get(e.pointerId)
      if (!p) return
      S.pointers.delete(e.pointerId)
      const c = cb()
      if (S.activeDrag) {
        if (c.onTableDragEnd) c.onTableDragEnd(S.activeDrag.tableId)
        S.activeDrag = null
        S.pendingDragSvg = null
      }
      if (S.pinchState) {
        S.pinchState = null
        S.pendingPinch = null
        if (c.onPinchEnd) c.onPinchEnd({ scale: 1 })
      }
      S.panState = null
      S.pendingPanDelta = null
      maybeUnbindGlobal()
    }

    function bindGlobal() {
      if (S.bound) return
      window.addEventListener('pointermove', handlePointerMove, { passive: false })
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerCancel)
      S.bound = true
    }

    function maybeUnbindGlobal() {
      if (S.pointers.size > 0) return
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      S.bound = false
    }

    engineRef.current = {
      handlePointerDownTable,
      handlePointerDownEmpty,
      clientToSvg,
      maybeUnbindGlobal,
    }
  }

  // Unbind global listeners on unmount.
  useEffect(() => {
    const engine = engineRef.current
    return () => engine.maybeUnbindGlobal()
  }, [])

  const { handlePointerDownTable, handlePointerDownEmpty, clientToSvg } =
    engineRef.current
  return { handlePointerDownTable, handlePointerDownEmpty, clientToSvg }
}