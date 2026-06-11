import { useMemo, useState } from 'react'
import { useHallStore } from '@/stores/hall'

/**
 * Free-table picker. (Was TablePickerSheet.vue.)
 * A plain bottom-anchored overlay (not the gesture BottomSheet). Shows a
 * non-interactive SVG of each hall; tapping a free table selects it.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - hall getters are methods → subscribe to raw halls/tables/activeHallId,
 *   derive sortedHalls / activeHall / tables via useMemo.
 * - The Vue `watch(visible)` that re-seeds the local active hall on open is
 *   handled by keying the inner content on visibility at the parent isn't
 *   needed: we seed local activeHallId lazily and fall back to the store's
 *   active hall through useMemo when the local one is null.
 * - $emit('select'|'close') → onSelect / onClose.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function TablePickerSheet({
  visible = false,
  currentTableId = null,
  freeOnly = true,
  onClose,
  onSelect,
}) {
  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)
  const storeActiveHallId = useHallStore((s) => s.activeHallId)

  const [localHallId, setLocalHallId] = useState(null)

  const sortedHalls = useMemo(
    () => [...halls].sort((a, b) => a.position - b.position),
    [halls],
  )
  const activeHallId =
    localHallId || storeActiveHallId || sortedHalls[0]?.id || null
  const activeHall = useMemo(
    () => halls.find((h) => h.id === activeHallId) ?? null,
    [halls, activeHallId],
  )
  const hallTables = useMemo(
    () => (activeHallId ? tables.filter((t) => t.hall_id === activeHallId) : []),
    [tables, activeHallId],
  )

  if (!visible) return null

  const isBlocked = (t) => {
    if (t.id === currentTableId) return false
    if (freeOnly && t.order_id) return true
    return false
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="tps-overlay" onClick={onOverlayClick}>
      <div className="tps-sheet">
        <header className="tps-header">
          <h3 className="tps-title">Выбрать стол</h3>
          <button className="tps-close" onClick={() => onClose?.()}>
            ×
          </button>
        </header>

        {sortedHalls.length > 1 && (
          <div className="tps-halls-tabs">
            {sortedHalls.map((h) => (
              <button
                key={h.id}
                className={
                  h.id === activeHallId ? 'tps-hall-tab tps-hall-tab--active' : 'tps-hall-tab'
                }
                onClick={() => setLocalHallId(h.id)}
              >
                {h.name}
              </button>
            ))}
          </div>
        )}

        {activeHall ? (
          <div className="tps-map-wrap">
            <svg
              className="tps-map"
              viewBox={`0 0 ${activeHall.width} ${activeHall.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              <rect
                width={activeHall.width}
                height={activeHall.height}
                className="tps-bg"
                strokeWidth="2"
              />
              {hallTables.map((t) => {
                const blocked = isBlocked(t)
                const cls = [
                  'tps-table',
                  `tps-table--${t.status}`,
                  t.id === currentTableId ? 'tps-table--current' : '',
                  blocked ? 'tps-table--blocked' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <g
                    key={t.id}
                    transform={`translate(${t.x} ${t.y}) rotate(${t.rotation || 0} ${t.width / 2} ${t.height / 2})`}
                    className={cls}
                    onClick={() => !blocked && onSelect?.(t.id)}
                  >
                    <rect
                      width={t.width}
                      height={t.height}
                      rx={t.border_radius}
                      ry={t.border_radius}
                      className="tps-table-rect"
                    />
                    <text
                      x={t.width / 2}
                      y={t.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="tps-table-num"
                    >
                      {t.number}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        ) : (
          <div className="tps-empty">
            <p>В этом заведении пока нет залов.</p>
          </div>
        )}

        <div className="tps-legend">
          <span className="tps-legend-item">
            <span className="tps-legend-dot tps-legend-dot--free" />
            Свободен
          </span>
          <span className="tps-legend-item">
            <span className="tps-legend-dot tps-legend-dot--waiting" />
            Не подано
          </span>
          <span className="tps-legend-item">
            <span className="tps-legend-dot tps-legend-dot--occupied" />
            Ждёт оплаты
          </span>
          <span className="tps-legend-item">
            <span className="tps-legend-dot tps-legend-dot--reserved" />
            Резерв
          </span>
        </div>

        <footer className="tps-footer">
          <button className="btn btn--ghost" onClick={() => onSelect?.(null)}>
            Без стола
          </button>
        </footer>
      </div>
    </div>
  )
}