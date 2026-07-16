import { useEffect, useRef, useState } from 'react'
import { PlusIcon, MinusIcon, FitIcon } from '@/components/menu/menuIcons'
import { ED_SNAP, edClamp } from '@/utils/hallGeometry'

/**
 * Полотно редактора — 1:1 EdCanvas из прототипа waiter-note-map-editor
 * (map-redesign/editor-canvas.jsx): dot-grid в координатах карты, рамка
 * зала 1.5px r12, pan (порог 6px, тап по пустому снимает выделение),
 * зум ×1.25/÷0.8 clamp [fit·0.6…2.5] с пилюлей-процентом, drag стола
 * (порог 4px) со снапом центра к сетке 8 ед. и clamp видимого bbox в
 * границы зала. Тени у стола — только на время drag.
 *
 * Props: hall, tables, selectedId, pulseId, controlsHidden, apiRef
 * (center()), onSelect(id|null), onDragStart(id), onMoveLive(id,x,y),
 * onDragEnd({id,x,y,prevX,prevY}), children (FAB).
 */
function EdTableNode({ t, selected, dragging, pulse, onPointerDown }) {
  const cls = [
    'ed2-table',
    selected ? 'ed2-table--sel' : '',
    dragging ? 'ed2-table--drag' : '',
    pulse ? 'ed2-table--pulse' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      onPointerDown={onPointerDown}
      style={{
        left: t.x,
        top: t.y,
        width: t.width,
        height: t.height,
        borderRadius: t.border_radius,
        transform: `rotate(${t.rotation || 0}deg)${dragging ? ' scale(1.04)' : ''}`,
      }}
    >
      <div
        className="ed2-table-inner"
        style={{ transform: `rotate(${-(t.rotation || 0)}deg)` }}
      >
        <span className="ed2-table-num">№{t.number}</span>
      </div>
      {selected &&
        !dragging &&
        [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([hx, hy], i) => (
          <span
            key={i}
            className="ed2-handle"
            style={{
              left: hx ? 'auto' : -6,
              right: hx ? -6 : 'auto',
              top: hy ? 'auto' : -6,
              bottom: hy ? -6 : 'auto',
            }}
          />
        ))}
    </div>
  )
}

export default function HallEditorCanvas({
  hall,
  tables,
  selectedId,
  pulseId,
  controlsHidden = false,
  apiRef,
  onSelect,
  onDragStart,
  onMoveLive,
  onDragEnd,
  children,
}) {
  const wrapRef = useRef(null)
  const fitScaleRef = useRef(1)
  const movedRef = useRef(false)
  const panRef = useRef(null)
  const [panning, setPanning] = useState(false)
  const [dragId, setDragId] = useState(null)
  const [view, setView] = useState(null)

  const fit = () => {
    const el = wrapRef.current
    if (!el) return
    const bw = hall.width + 40
    const bh = hall.height + 40
    const s = Math.min(el.clientWidth / bw, el.clientHeight / bh)
    fitScaleRef.current = s
    setView({
      s,
      tx: (el.clientWidth - hall.width * s) / 2,
      ty: (el.clientHeight - hall.height * s) / 2,
    })
  }
  useEffect(fit, [hall.id, hall.width, hall.height])

  // API наружу (центр видимой области) — пишем ref после коммита.
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      center: () => {
        const el = wrapRef.current
        if (!el || !view) return { x: hall.width / 2, y: hall.height / 2 }
        return {
          x: (el.clientWidth / 2 - view.tx) / view.s,
          y: (el.clientHeight / 2 - view.ty) / view.s,
        }
      },
    }
  })

  const zoom = (f) =>
    setView((v) => {
      const el = wrapRef.current
      if (!v || !el) return v
      const s2 = Math.min(2.5, Math.max(fitScaleRef.current * 0.6, v.s * f))
      const k = s2 / v.s
      const cx = el.clientWidth / 2
      const cy = el.clientHeight / 2
      return { s: s2, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })

  /* pan по пустому месту; тап без движения снимает выделение */
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)

  const down = (e) => {
    if (!view) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      // второй палец: pan → pinch (зум вокруг середины жеста)
      const [p1, p2] = [...pointersRef.current.values()]
      const rect = wrapRef.current.getBoundingClientRect()
      pinchRef.current = {
        dist: Math.hypot(p1.x - p2.x, p1.y - p2.y),
        s: view.s,
        wx: ((p1.x + p2.x) / 2 - rect.left - view.tx) / view.s,
        wy: ((p1.y + p2.y) / 2 - rect.top - view.ty) / view.s,
        left: rect.left,
        top: rect.top,
      }
      panRef.current = null
      movedRef.current = true
      setPanning(true)
    } else if (pointersRef.current.size === 1) {
      panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
      movedRef.current = false
      setPanning(true)
    }
  }
  const move = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    if (pinch && pointersRef.current.size >= 2) {
      const [p1, p2] = [...pointersRef.current.values()]
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      const s2 = Math.min(2.5, Math.max(fitScaleRef.current * 0.6, (pinch.s * dist) / (pinch.dist || 1)))
      const mx = (p1.x + p2.x) / 2 - pinch.left
      const my = (p1.y + p2.y) / 2 - pinch.top
      setView((v) => ({ ...v, s: s2, tx: mx - pinch.wx * s2, ty: my - pinch.wy * s2 }))
      return
    }
    const d = panRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (Math.abs(dx) + Math.abs(dy) > 6) movedRef.current = true
    if (movedRef.current) setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }))
  }
  const up = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 1 && view) {
      // остался один палец — продолжаем pan без рывка
      const [p] = [...pointersRef.current.values()]
      panRef.current = { x: p.x, y: p.y, tx: view.tx, ty: view.ty }
    }
    if (pointersRef.current.size === 0) {
      if (panRef.current && !movedRef.current) onSelect?.(null)
      panRef.current = null
      setPanning(false)
    }
  }

  /* drag стола: порог 4px, снап центра, clamp; live через onMoveLive,
     итог одним onDragEnd (для PATCH + undo) */
  const tDown = (t) => (e) => {
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const start = { px: e.clientX, py: e.clientY, x: t.x, y: t.y, moved: false }
    let last = { x: t.x, y: t.y }
    const mv = (ev) => {
      const s = view ? view.s : 1
      const dx = (ev.clientX - start.px) / s
      const dy = (ev.clientY - start.py) / s
      if (!start.moved && Math.abs(dx) + Math.abs(dy) > 4 / s) {
        start.moved = true
        onDragStart?.(t.id)
        setDragId(t.id)
      }
      if (start.moved) {
        const cx = Math.round((start.x + dx + t.width / 2) / ED_SNAP) * ED_SNAP
        const cy = Math.round((start.y + dy + t.height / 2) / ED_SNAP) * ED_SNAP
        const clamped = edClamp(
          { ...t, x: cx - t.width / 2, y: cy - t.height / 2 },
          hall,
        )
        last = { x: clamped.x, y: clamped.y }
        onMoveLive?.(t.id, clamped.x, clamped.y)
      }
    }
    const fin = () => {
      el.removeEventListener('pointermove', mv)
      el.removeEventListener('pointerup', fin)
      el.removeEventListener('pointercancel', fin)
      setDragId(null)
      if (start.moved) {
        onDragEnd?.({ id: t.id, x: last.x, y: last.y, prevX: start.x, prevY: start.y })
      } else {
        onSelect?.(t.id)
      }
    }
    el.addEventListener('pointermove', mv)
    el.addEventListener('pointerup', fin)
    el.addEventListener('pointercancel', fin)
  }

  return (
    <div
      ref={wrapRef}
      className={`mp-canvas${panning ? ' mp-canvas--dragging' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        backgroundSize: view ? `${16 * view.s}px ${16 * view.s}px` : '16px 16px',
        backgroundPosition: view ? `${view.tx}px ${view.ty}px` : '0 0',
      }}
    >
      {view && (
        <div
          className={`mp-layer${panning || dragId != null ? ' mp-layer--nt' : ''}`}
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}
        >
          <div
            className="ed2-hall-frame"
            style={{ width: hall.width, height: hall.height }}
            aria-hidden
          />
          {tables.map((t) => (
            <EdTableNode
              key={`${t.id}${pulseId === t.id ? '-p' : ''}`}
              t={t}
              selected={selectedId === t.id}
              dragging={dragId === t.id}
              pulse={pulseId === t.id}
              onPointerDown={tDown(t)}
            />
          ))}
        </div>
      )}

      {tables.length === 0 && (
        <div className="ed2-empty-hint">
          <span>Нажмите ＋, чтобы добавить первый стол</span>
        </div>
      )}

      {!controlsHidden && (
        <div className="mp-zoom">
          <span className="mp-zoom-pct">{view ? Math.round(view.s * 100) : 100}%</span>
          <button type="button" className="mp-zoom-btn" aria-label="Приблизить" onClick={(e) => { e.stopPropagation(); zoom(1.25) }} onPointerDown={(e) => e.stopPropagation()}>
            <PlusIcon width={17} height={17} />
          </button>
          <button type="button" className="mp-zoom-btn" aria-label="Отдалить" onClick={(e) => { e.stopPropagation(); zoom(0.8) }} onPointerDown={(e) => e.stopPropagation()}>
            <MinusIcon width={17} height={17} />
          </button>
          <button type="button" className="mp-zoom-btn" aria-label="Вписать зал" onClick={(e) => { e.stopPropagation(); fit() }} onPointerDown={(e) => e.stopPropagation()}>
            <FitIcon width={17} height={17} />
          </button>
        </div>
      )}
      {children}
    </div>
  )
}