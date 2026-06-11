import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSvgInput } from '@/hooks/useSvgInput'

/**
 * Hall EDITOR canvas (drag-drop). React port of HallEditorCanvas.vue.
 *
 * Differences vs the viewer HallCanvas:
 * - Provides onTableDragStart/Move/End to useSvgInput, so a moved finger on
 *   a table drags it (snap-to-grid, clamp to hall) instead of panning.
 * - dragOverride is local state so the dragged table follows instantly
 *   without writing to the store every frame; commit on drop via onTableDrop.
 * - Emits table-tap / table-drop / canvas-tap.
 * - No viewport persistence (editor always centers on mount / hall change).
 *
 * Shared patterns with HallCanvas: scale/pan in useState, gesture state in
 * refs, centerOnTable/getViewportCenter via useImperativeHandle.
 */

const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 3, 4]
const MIN_SCALE = ZOOM_LEVELS[0]
const MAX_SCALE = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

function nextLevelAbove(s) {
  return ZOOM_LEVELS.find((lv) => lv > s + 0.001) ?? MAX_SCALE
}
function nextLevelBelow(s) {
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
    if (ZOOM_LEVELS[i] < s - 0.001) return ZOOM_LEVELS[i]
  }
  return MIN_SCALE
}
function nearestLevel(s) {
  let best = ZOOM_LEVELS[0]
  let bestDiff = Math.abs(best - s)
  for (const lv of ZOOM_LEVELS) {
    const d = Math.abs(lv - s)
    if (d < bestDiff) {
      best = lv
      bestDiff = d
    }
  }
  return best
}

function HallEditorCanvasInner(
  {
    hall,
    tables,
    selectedId = null,
    pulseTableId = null,
    gridStep = 10,
    snap = true,
    onTableTap,
    onTableDrop,
    onCanvasTap,
  },
  ref,
) {
  const svgRef = useRef(null)
  const [scale, setScale] = useState(2)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverride, setDragOverride] = useState(null) // { x, y }

  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const pinchStartScale = useRef(1)
  const centerAnimRaf = useRef(null)
  // Mirrors for gesture closures (avoid stale reads).
  const tablesRef = useRef(tables)
  tablesRef.current = tables
  const snapRef = useRef(snap)
  snapRef.current = snap
  const dragOverrideRef = useRef(dragOverride)
  dragOverrideRef.current = dragOverride

  const canZoomIn = scale < MAX_SCALE - 0.001
  const canZoomOut = scale > MIN_SCALE + 0.001
  const zoomLabel = `${Math.round(scale * 100)}%`

  const viewBox = useMemo(() => {
    const w = hall.width / scale
    const h = hall.height / scale
    const maxPanX = Math.max(0, hall.width - w)
    const maxPanY = Math.max(0, hall.height - h)
    const px = Math.max(0, Math.min(panX, maxPanX))
    const py = Math.max(0, Math.min(panY, maxPanY))
    return { x: px, y: py, w, h }
  }, [hall.width, hall.height, scale, panX, panY])
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`
  const viewBoxRef = useRef(viewBox)
  viewBoxRef.current = viewBox

  const setScaleAroundCenter = (newScale) => {
    const oldVb = viewBoxRef.current
    const centerSvg = { x: oldVb.x + oldVb.w * 0.5, y: oldVb.y + oldVb.h * 0.5 }
    const clamped = clamp(newScale, MIN_SCALE, MAX_SCALE)
    const newW = hall.width / clamped
    const newH = hall.height / clamped
    setScale(clamped)
    setPanX(centerSvg.x - newW * 0.5)
    setPanY(centerSvg.y - newH * 0.5)
  }

  const zoomIn = () => canZoomIn && setScaleAroundCenter(nextLevelAbove(scale))
  const zoomOut = () => canZoomOut && setScaleAroundCenter(nextLevelBelow(scale))
  const resetView = () => {
    setScale(1)
    setPanX(0)
    setPanY(0)
  }

  // Center on mount / hall change.
  useEffect(() => {
    const s = scaleRef.current
    const w = hall.width / s
    const h = hall.height / s
    setPanX((hall.width - w) / 2)
    setPanY((hall.height - h) / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall?.id])

  const snapTo = (value) => {
    if (!snapRef.current) return value
    return Math.round(value / gridStep) * gridStep
  }
  const clampToHall = (table, x, y) => {
    const maxX = hall.width - table.width
    const maxY = hall.height - table.height
    return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) }
  }

  const { handlePointerDownTable, handlePointerDownEmpty } = useSvgInput({
    svgRef,
    getViewBox: () => viewBoxRef.current,
    callbacks: {
      onTableDragStart(tableId) {
        const t = tablesRef.current.find((x) => x.id === tableId)
        if (!t) return
        setDraggingId(tableId)
        setDragOverride({ x: t.x, y: t.y })
      },
      onTableDragMove(tableId, delta) {
        const t = tablesRef.current.find((x) => x.id === tableId)
        if (!t) return
        const rawX = t.x + delta.x
        const rawY = t.y + delta.y
        const { x, y } = clampToHall(t, snapTo(rawX), snapTo(rawY))
        setDragOverride({ x, y })
      },
      onTableDragEnd(tableId) {
        const override = dragOverrideRef.current
        const t = tablesRef.current.find((x) => x.id === tableId)
        setDraggingId(null)
        setDragOverride(null)
        if (!override || !t) return
        if (override.x !== t.x || override.y !== t.y) {
          onTableDrop?.({
            id: tableId,
            x: override.x,
            y: override.y,
            prevX: t.x,
            prevY: t.y,
          })
        }
      },
      onTableTap(tableId) {
        onTableTap?.(tableId)
      },
      onCanvasTap(svgPoint) {
        onCanvasTap?.(svgPoint)
      },
      onPan({ x, y }) {
        setPanX((v) => v - x)
        setPanY((v) => v - y)
      },
      onPinch({ scale: rel, centerSvg }) {
        const target = clamp(pinchStartScale.current * rel, MIN_SCALE, MAX_SCALE)
        const newW = hall.width / target
        const newH = hall.height / target
        setPanX(centerSvg.x - newW * 0.5)
        setPanY(centerSvg.y - newH * 0.5)
        setScale(target)
      },
      onPinchEnd() {
        const snapped = nearestLevel(scaleRef.current)
        if (Math.abs(snapped - scaleRef.current) > 0.001) {
          setScaleAroundCenter(snapped)
        }
      },
    },
  })

  const onTablePointerDown = (e, id) => {
    pinchStartScale.current = scaleRef.current
    handlePointerDownTable(e, id)
  }
  const onEmptyPointerDown = (e) => {
    pinchStartScale.current = scaleRef.current
    handlePointerDownEmpty(e)
  }

  useImperativeHandle(ref, () => ({
    centerOnTable(tableId, { verticalBias = 0.35, duration = 280 } = {}) {
      const t = tablesRef.current.find((x) => x.id === tableId)
      if (!t) return
      const cx = t.x + t.width / 2
      const cy = t.y + t.height / 2
      const vb = viewBoxRef.current
      const targetX = cx - vb.w / 2
      const targetY = cy - vb.h * verticalBias
      if (
        Math.abs(targetX - vb.x) < 1 &&
        Math.abs(targetY - vb.y) < 1
      ) {
        return
      }
      if (centerAnimRaf.current) cancelAnimationFrame(centerAnimRaf.current)
      const startX = vb.x
      const startY = vb.y
      const t0 = performance.now()
      const easeOut = (p) => 1 - Math.pow(1 - p, 3)
      const stepFn = (now) => {
        const p = Math.min(1, (now - t0) / duration)
        const eased = easeOut(p)
        setPanX(startX + (targetX - startX) * eased)
        setPanY(startY + (targetY - startY) * eased)
        if (p < 1) centerAnimRaf.current = requestAnimationFrame(stepFn)
        else centerAnimRaf.current = null
      }
      centerAnimRaf.current = requestAnimationFrame(stepFn)
    },
    getViewportCenter() {
      const vb = viewBoxRef.current
      return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }
    },
  }))

  // Tables with the drag override applied for the dragged one.
  const renderedTables = useMemo(() => {
    if (!draggingId || !dragOverride) return tables
    return tables.map((t) =>
      t.id === draggingId ? { ...t, x: dragOverride.x, y: dragOverride.y } : t,
    )
  }, [tables, draggingId, dragOverride])

  return (
    <div className="hc-wrap">
      <svg
        ref={svgRef}
        className="hc-canvas"
        viewBox={viewBoxStr}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="ed-grid-minor" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="#eef0f2" strokeWidth="1" />
          </pattern>
          <pattern id="ed-grid-major" width={gridStep * 5} height={gridStep * 5} patternUnits="userSpaceOnUse">
            <rect width={gridStep * 5} height={gridStep * 5} fill="url(#ed-grid-minor)" />
            <path d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`} fill="none" stroke="#dde2e7" strokeWidth="1" />
          </pattern>
        </defs>

        <rect className="hc-bg" width={hall.width} height={hall.height} fill="#fafbfc" onPointerDown={onEmptyPointerDown} />
        <rect width={hall.width} height={hall.height} fill="url(#ed-grid-major)" pointerEvents="none" />
        <rect width={hall.width} height={hall.height} fill="none" stroke="#cfd8dc" strokeWidth="2" pointerEvents="none" />

        {renderedTables.map((t) => {
          const cls = [
            'hc-table',
            'hc-table--editable',
            t.id === selectedId ? 'hc-table--selected' : '',
            t.id === draggingId ? 'hc-table--dragging' : '',
            t.id === pulseTableId ? 'hc-table--pulse' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <g
              key={t.id}
              className={cls}
              transform={`translate(${t.x} ${t.y}) rotate(${t.rotation || 0} ${t.width / 2} ${t.height / 2})`}
              onPointerDown={(e) => onTablePointerDown(e, t.id)}
            >
              {t.id === pulseTableId && (
                <rect
                  className="hc-table-pulse"
                  x={-10}
                  y={-10}
                  width={t.width + 20}
                  height={t.height + 20}
                  rx={(t.border_radius || 0) + 10}
                  fill="none"
                />
              )}
              <rect
                width={t.width}
                height={t.height}
                rx={t.border_radius}
                ry={t.border_radius}
                className="hc-table-rect"
              />
              <text
                x={t.width / 2}
                y={t.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="hc-table-num"
              >
                {t.number}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="hc-zoom">
        <button className="hc-zoom-btn" onClick={zoomOut} disabled={!canZoomOut}>
          −
        </button>
        <button className="hc-zoom-btn hc-zoom-btn--reset" onClick={resetView}>
          {zoomLabel}
        </button>
        <button className="hc-zoom-btn" onClick={zoomIn} disabled={!canZoomIn}>
          +
        </button>
      </div>
    </div>
  )
}

const HallEditorCanvas = forwardRef(HallEditorCanvasInner)
export default HallEditorCanvas