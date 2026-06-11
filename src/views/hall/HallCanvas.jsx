import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSvgInput } from '@/hooks/useSvgInput'
import { loadHallViewport, saveHallViewport } from '@/utils/hallViewport'

/**
 * Hall map canvas (viewer). React port of HallCanvas.vue.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - scale/panX/panY affect the rendered viewBox → useState.
 * - viewBox / viewBoxStr / canZoom* / zoomLabel are derived → useMemo.
 * - Gesture callbacks read fresh scale via a ref (handlerScale) so the
 *   stable useSvgInput closures see the latest value without rebinding.
 * - persist timer + centerOnTable animation rAF → useRef bookkeeping.
 * - defineExpose(centerOnTable, getViewportCenter) → useImperativeHandle.
 * - watch(hall.id) restoreOrCenter → useEffect keyed on hall.id.
 * - $emit('table-click', table) → onTableClick(table).
 * ─────────────────────────────────────────────────────────────────────
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

function HallCanvasInner(
  { hall, tables, pulseTableId = null, gridStep = 10, onTableClick },
  ref,
) {
  const svgRef = useRef(null)
  const [scale, setScale] = useState(2)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)

  // Mutable mirrors so gesture closures read fresh values.
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const pinchStartScale = useRef(1)
  const persistTimer = useRef(null)
  const centerAnimRaf = useRef(null)

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

  // Keep a ref to the current viewBox for gesture math (always fresh).
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

  const zoomIn = () => {
    if (canZoomIn) setScaleAroundCenter(nextLevelAbove(scale))
  }
  const zoomOut = () => {
    if (canZoomOut) setScaleAroundCenter(nextLevelBelow(scale))
  }
  const resetView = () => {
    setScale(1)
    setPanX(0)
    setPanY(0)
  }

  // Restore saved viewport for this hall (or center). Runs on hall change.
  // Reads from localStorage (external system) and seeds scale/pan — the
  // intended "sync external → React" effect, so the rule is disabled here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = loadHallViewport(hall?.id)
    if (saved) {
      const s = clamp(saved.scale, MIN_SCALE, MAX_SCALE)
      setScale(s)
      setPanX(saved.panX)
      setPanY(saved.panY)
    } else {
      const s = scaleRef.current
      const w = hall.width / s
      const h = hall.height / s
      setPanX((hall.width - w) / 2)
      setPanY((hall.height - h) / 2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall?.id])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist viewport (debounced) whenever scale/pan settle.
  useEffect(() => {
    if (!hall?.id) return
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      saveHallViewport(hall.id, { scale, panX, panY })
    }, 300)
    return () => clearTimeout(persistTimer.current)
  }, [hall?.id, scale, panX, panY])

  // === Gesture wiring ===
  const { handlePointerDownTable, handlePointerDownEmpty } = useSvgInput({
    svgRef,
    getViewBox: () => viewBoxRef.current,
    callbacks: {
      onTableTap(tableId) {
        const t = tables.find((x) => x.id === tableId)
        if (t) onTableClick?.(t)
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

  // === Imperative API for the parent (map.jsx) ===
  useImperativeHandle(ref, () => ({
    centerOnTable(tableId, { verticalBias = 0.35, duration = 280 } = {}) {
      const t = tables.find((x) => x.id === tableId)
      if (!t) return
      const cx = t.x + t.width / 2
      const cy = t.y + t.height / 2
      const vb = viewBoxRef.current
      const targetX = cx - vb.w / 2
      const targetY = cy - vb.h * verticalBias

      if (
        Math.abs(targetX - viewBoxRef.current.x) < 1 &&
        Math.abs(targetY - viewBoxRef.current.y) < 1
      ) {
        return
      }
      if (centerAnimRaf.current) {
        cancelAnimationFrame(centerAnimRaf.current)
        centerAnimRaf.current = null
      }
      const startX = viewBoxRef.current.x
      const startY = viewBoxRef.current.y
      const t0 = performance.now()
      const easeOut = (p) => 1 - Math.pow(1 - p, 3)
      const step = (now) => {
        const elapsed = now - t0
        const p = Math.min(1, elapsed / duration)
        const eased = easeOut(p)
        setPanX(startX + (targetX - startX) * eased)
        setPanY(startY + (targetY - startY) * eased)
        if (p < 1) centerAnimRaf.current = requestAnimationFrame(step)
        else centerAnimRaf.current = null
      }
      centerAnimRaf.current = requestAnimationFrame(step)
    },
    getViewportCenter() {
      const vb = viewBoxRef.current
      return { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }
    },
  }))

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
          <pattern
            id="vw-grid-minor"
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
              fill="none"
              stroke="#eef0f2"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="vw-grid-major"
            width={gridStep * 5}
            height={gridStep * 5}
            patternUnits="userSpaceOnUse"
          >
            <rect width={gridStep * 5} height={gridStep * 5} fill="url(#vw-grid-minor)" />
            <path
              d={`M ${gridStep * 5} 0 L 0 0 0 ${gridStep * 5}`}
              fill="none"
              stroke="#dde2e7"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect
          className="hc-bg"
          width={hall.width}
          height={hall.height}
          fill="#fafbfc"
          onPointerDown={onEmptyPointerDown}
        />
        <rect
          width={hall.width}
          height={hall.height}
          fill="url(#vw-grid-major)"
          pointerEvents="none"
        />
        <rect
          width={hall.width}
          height={hall.height}
          fill="none"
          stroke="#cfd8dc"
          strokeWidth="2"
          pointerEvents="none"
        />

        {tables.map((t) => (
          <g
            key={t.id}
            className={`hc-table hc-table--${t.status}${t.id === pulseTableId ? ' hc-table--pulse' : ''}`}
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
        ))}
      </svg>

      <div className="hc-zoom">
        <button className="hc-zoom-btn" onClick={zoomOut} disabled={!canZoomOut} aria-label="Уменьшить">
          −
        </button>
        <button className="hc-zoom-btn hc-zoom-btn--reset" onClick={resetView} title={zoomLabel}>
          {zoomLabel}
        </button>
        <button className="hc-zoom-btn" onClick={zoomIn} disabled={!canZoomIn} aria-label="Увеличить">
          +
        </button>
      </div>
    </div>
  )
}

const HallCanvas = forwardRef(HallCanvasInner)
export default HallCanvas