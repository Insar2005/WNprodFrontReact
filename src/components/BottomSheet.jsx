import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { useDraggableSheet } from '@/hooks/useDraggableSheet'

/**
 * Draggable bottom sheet. React port of BottomSheet.vue.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Named slots (#header, #footer, default) → `header` / `footer` props +
 *   `children`. Present-check is just truthiness of the prop.
 * - snapPoints fractions (≤1) → px via window.innerHeight, memoized.
 * - defineExpose({ snapTo, currentSnapIdx }) → useImperativeHandle.
 * - The handle area binds onPointerDown to the drag logic; the sheet body
 *   stops pointerdown propagation so taps inside don't start a drag.
 * ─────────────────────────────────────────────────────────────────────
 */
function BottomSheetInner(
  {
    visible = false,
    snapPoints = [90, 0.5, 0.9],
    initialSnap = 1,
    dismissOnBackdrop = false,
    header = null,
    footer = null,
    onSnapChange,
    onClose,
    children,
  },
  ref,
) {
  const resolvedSnaps = useMemo(
    () => snapPoints.map((p) => (p > 1 ? p : window.innerHeight * p)),
    [snapPoints],
  )

  const sheet = useDraggableSheet({
    snapPoints: resolvedSnaps,
    initialIdx: initialSnap,
    onSnapChange,
  })

  useImperativeHandle(ref, () => ({
    snapTo: sheet.snapTo,
    currentSnapIdx: () => sheet.currentSnapIdx,
  }))

  if (!visible) return null

  const onBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return
    if (!dismissOnBackdrop) return
    sheet.snapTo(0)
    onClose?.()
  }

  const sheetClass = [
    'bs-sheet',
    sheet.isDragging ? 'bs-sheet--dragging' : '',
    sheet.isAnimating ? 'bs-sheet--animating' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="bs-overlay" onClick={onBackdropClick}>
      <div
        className={sheetClass}
        style={{ height: `${sheet.currentHeight}px` }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="bs-handle-area" onPointerDown={sheet.handlePointerDown}>
          <div className="bs-handle" />
          {header && <div className="bs-header">{header}</div>}
        </div>

        <div
          className={
            sheet.contentScrollable
              ? 'bs-content bs-content--scrollable'
              : 'bs-content'
          }
        >
          {children}
        </div>

        {footer && <div className="bs-footer">{footer}</div>}
      </div>
    </div>
  )
}

const BottomSheet = forwardRef(BottomSheetInner)
export default BottomSheet