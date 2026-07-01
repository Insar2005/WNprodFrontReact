import { useEffect, useRef, useState } from 'react'

/**
 * Draggable bottom-sheet logic. React port of the Vue useDraggableSheet
 * composable. Pure logic — renders nothing; exposes height + handlers.
 *
 * snapPoints: distances from the BOTTOM in px (already resolved from any
 * fractions by the caller).
 *
 * Tap-vs-drag detection: if the pointer barely moved (< 6px total) and was
 * down for less than 250ms, treat it as a TAP and toggle between the
 * first and last snap point (instead of snapping to "closest"). This lets
 * a user tap the header to expand/collapse the sheet without dragging.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - currentHeight/currentSnapIdx/isDragging/isAnimating affect render →
 *   useState. Drag tracking is bookkeeping → refs.
 * - Built as a one-time engine (like useSvgInput): the stable handler
 *   closures reach component state through a single `cfg` ref that an
 *   effect keeps fresh, so we never read/write other refs during render.
 * - Window listeners bound during a drag, removed on up + on unmount.
 * ─────────────────────────────────────────────────────────────────────
 */
export function useDraggableSheet({ snapPoints, initialIdx = 0, onSnapChange } = {}) {
  if (!snapPoints || snapPoints.length === 0) {
    throw new Error('useDraggableSheet: snapPoints required')
  }

  const [currentSnapIdx, setCurrentSnapIdx] = useState(initialIdx)
  const [currentHeight, setCurrentHeight] = useState(snapPoints[initialIdx])
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Single config ref the engine reads through (kept fresh by the effect
  // below). Mirrors the useSvgInput pattern so no other ref is touched
  // during render.
  const cfg = useRef({
    snapPoints,
    currentSnapIdx,
    currentHeight,
    onSnapChange,
    setCurrentSnapIdx,
    setCurrentHeight,
    setIsDragging,
    setIsAnimating,
  })
  useEffect(() => {
    cfg.current.snapPoints = snapPoints
    cfg.current.currentSnapIdx = currentSnapIdx
    cfg.current.currentHeight = currentHeight
    cfg.current.onSnapChange = onSnapChange
  })

  const contentScrollable = currentSnapIdx === snapPoints.length - 1

  // Build the engine once.
  const engineRef = useRef(null)
  if (engineRef.current === null) {
    const drag = {
      startY: 0,
      startHeight: 0,
      startTime: 0,
      pointerId: null,
      lastHeight: 0,
      lastTime: 0,
      velocity: 0,
      maxDelta: 0, // largest absolute Y movement during this gesture
      rafScheduled: false,
    }
    let animTimer = null

    // Tap = barely moved (< 6px) and quick (< 250ms). Anything else is
    // a drag — even a slow press, since the user clearly intended to
    // grab and hold.
    const TAP_MAX_DELTA = 6
    const TAP_MAX_DURATION = 250

    function snapTo(idx) {
      const c = cfg.current
      const snaps = c.snapPoints
      const newIdx = Math.max(0, Math.min(idx, snaps.length - 1))
      c.setIsAnimating(true)
      c.setCurrentHeight(snaps[newIdx])
      if (newIdx !== c.currentSnapIdx) {
        c.setCurrentSnapIdx(newIdx)
        c.onSnapChange?.(newIdx)
      }
      clearTimeout(animTimer)
      animTimer = setTimeout(() => c.setIsAnimating(false), 250)
    }

    function pickSnapTarget(height, velocity) {
      const c = cfg.current
      const snaps = c.snapPoints
      const FLING = 0.4 // px/ms
      const cur = c.currentSnapIdx
      if (velocity > FLING && cur < snaps.length - 1) {
        return Math.min(cur + 1, snaps.length - 1)
      }
      if (velocity < -FLING && cur > 0) return Math.max(cur - 1, 0)
      let bestIdx = 0
      let bestDist = Infinity
      snaps.forEach((p, i) => {
        const d = Math.abs(p - height)
        if (d < bestDist) {
          bestDist = d
          bestIdx = i
        }
      })
      return bestIdx
    }

    function onMove(e) {
      if (e.pointerId !== drag.pointerId) return
      e.preventDefault()
      // Track max absolute delta for tap-detection in onUp. Doing it here
      // (not inside the rAF) means even tiny moves that don't make it
      // into a frame still count, so the tap check is faithful.
      const dy = Math.abs(e.clientY - drag.startY)
      if (dy > drag.maxDelta) drag.maxDelta = dy
      if (drag.rafScheduled) return
      drag.rafScheduled = true
      requestAnimationFrame(() => {
        drag.rafScheduled = false
        const snaps = cfg.current.snapPoints
        const deltaY = drag.startY - e.clientY
        let newHeight = drag.startHeight + deltaY
        const minH = snaps[0]
        const maxH = snaps[snaps.length - 1]
        if (newHeight < minH) newHeight = minH - (minH - newHeight) * 0.3
        else if (newHeight > maxH) newHeight = maxH + (newHeight - maxH) * 0.3
        const now = performance.now()
        const dt = now - drag.lastTime
        if (dt > 0) drag.velocity = (newHeight - drag.lastHeight) / dt
        drag.lastHeight = newHeight
        drag.lastTime = now
        cfg.current.setCurrentHeight(newHeight)
      })
    }

    function onUp(e) {
      if (e.pointerId !== drag.pointerId) return
      drag.pointerId = null
      cfg.current.setIsDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)

      const duration = performance.now() - drag.startTime
      const isTap =
        drag.maxDelta < TAP_MAX_DELTA && duration < TAP_MAX_DURATION

      if (isTap) {
        // Toggle: from any snap go to the OPPOSITE end (first ↔ last).
        // With 2 snaps this is literally "the other one"; with more, we
        // pick whichever end is farther so a tap consistently flips the
        // sheet between collapsed and expanded.
        const c = cfg.current
        const last = c.snapPoints.length - 1
        const target = c.currentSnapIdx === last ? 0 : last
        snapTo(target)
      } else {
        snapTo(pickSnapTarget(drag.lastHeight, drag.velocity))
      }
    }

    function handlePointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      drag.pointerId = e.pointerId
      drag.startY = e.clientY
      drag.startHeight = cfg.current.currentHeight
      drag.startTime = performance.now()
      drag.lastHeight = drag.startHeight
      drag.lastTime = drag.startTime
      drag.velocity = 0
      drag.maxDelta = 0
      cfg.current.setIsDragging(true)
      cfg.current.setIsAnimating(false)
      e.target.setPointerCapture?.(e.pointerId)
      window.addEventListener('pointermove', onMove, { passive: false })
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }

    function cleanup() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      clearTimeout(animTimer)
    }

    engineRef.current = { handlePointerDown, snapTo, cleanup }
  }

  useEffect(() => {
    const engine = engineRef.current
    return () => engine.cleanup()
  }, [])

  const { handlePointerDown, snapTo } = engineRef.current
  return {
    currentSnapIdx,
    currentHeight,
    isDragging,
    isAnimating,
    contentScrollable,
    handlePointerDown,
    snapTo,
  }
}