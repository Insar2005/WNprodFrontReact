import { useRef, useState } from 'react'

/**
 * Single toast with swipe-to-dismiss + tap-to-dismiss.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - The pointer-drag logic is the same algorithm; Vue's @pointerdown etc.
 *   become onPointerDown props. `ref`s that were Vue `ref()` (dragX,
 *   dragging) split into React useState (for values that affect render)
 *   and useRef (for mutable bookkeeping that must NOT trigger re-render:
 *   pointerId, startX/Y, axis decision).
 * - Vue's <transition-group> gave enter/leave animation for free. React
 *   has no built-in equivalent; we animate ENTRY with a CSS keyframe
 *   (.toast mounts with wn-toast-in). Exit is immediate (good enough — the
 *   item just unmounts). If you later want exit animation, a small lib
 *   like framer-motion or react-transition-group would add it.
 * ─────────────────────────────────────────────────────────────────────
 */

const DISMISS_THRESHOLD = 80

export default function ToastItem({ toast, onDismiss }) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const pointerId = useRef(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const horizontal = useRef(null) // null undecided | true horizontal | false vertical

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return
    pointerId.current = e.pointerId
    startX.current = e.clientX
    startY.current = e.clientY
    horizontal.current = null
    setDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (horizontal.current === null) {
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)
      if (absX < 4 && absY < 4) return
      horizontal.current = absX > absY
      if (!horizontal.current) {
        // Vertical intent — release pointer, let native scroll run.
        e.currentTarget.releasePointerCapture?.(pointerId.current)
        setDragging(false)
        pointerId.current = null
        return
      }
    }
    setDragX(dx)
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    const shouldDismiss = Math.abs(dragX) >= DISMISS_THRESHOLD
    setDragging(false)
    if (shouldDismiss) {
      onDismiss()
    } else {
      setDragX(0)
    }
  }

  function onClick() {
    // Suppress the tap that follows a swipe ending near zero.
    if (Math.abs(dragX) > 4) return
    onDismiss()
  }

  function onActionClick(e) {
    e.stopPropagation()
    try {
      toast.action?.handler?.()
    } finally {
      onDismiss()
    }
  }

  const style =
    dragX === 0 && !dragging
      ? undefined
      : {
          transform: `translateX(${dragX}px)`,
          opacity: Math.max(0.2, 1 - Math.abs(dragX) / 200),
          transition: dragging
            ? 'none'
            : 'transform 0.2s ease, opacity 0.2s ease',
        }

  return (
    <div
      className={`toast toast--${toast.type} wn-toast-in`}
      role="status"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClick}
    >
      <span className="toast-msg">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onActionClick}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}