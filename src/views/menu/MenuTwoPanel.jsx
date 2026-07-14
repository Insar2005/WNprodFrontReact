import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Two-panel menu layout: vertical category rail on the left + scrollable
 * content pane on the right. Used by both MenuEditorView and
 * OrderBuilderView.
 *
 * Layout (from designer mockup, June 2026):
 *   ┌───────┬─────────────────────────────┐
 *   │ Кат 1 │  HeaderSlot (title + link)  │
 *   │ Кат 2 │  ─────────────────────────  │
 *   │•Кат 3 │  Item 1                     │
 *   │ Кат 4 │  Item 2                     │
 *   │ ...   │  Item 3                     │
 *   │ +Кат  │  ...                        │
 *   └───────┴─────────────────────────────┘
 *  116px wide   flex:1, independent scroll
 *
 * SCROLL CONTRACT (июль 2026):
 *   The wrap uses flex:1 with min-height:0 — this requires the HOST page
 *   to be a bounded flex column (height:100%, min-height:0). Otherwise
 *   the pane's overflow-y:auto won't engage and the whole app-content
 *   will scroll instead. Both .menu-page and .ob-page follow that
 *   pattern; if you build a new host, do the same.
 *
 * ENDLESS-DOWN LOOP (июль 2026):
 *   The items list loops seamlessly on downward scroll (iOS-picker style)
 *   inside the current category. Approach:
 *     • Render the items array TWICE inside the pane. The second copy is
 *       aria-hidden so screen readers don't announce duplicates.
 *     • Only render the second copy when the first copy is actually
 *       taller than the pane's client area — otherwise the duplicate
 *       would just sit visibly below as an ugly repeat. A ResizeObserver
 *       on both pane and list re-checks on orientation flips, keyboard
 *       opens, and content changes.
 *     • onScroll watches the seam (top of the second copy). Once crossed,
 *       we silently subtract firstCopy.offsetHeight from scrollTop. Both
 *       iOS Safari and Android Chrome preserve momentum across a direct
 *       scrollTop assignment, so the user experiences continuous scroll.
 *     • Upward stops at 0 naturally (only-down loop was the requested UX).
 *   Category tab switch resets scrollTop to 0 — landing users mid-list
 *   after tapping a fresh category tab would feel broken.
 *
 * Props
 *   categories    — sorted array of category objects (caller filters).
 *   selectedId    — currently-selected category id (controlled).
 *   items         — items of the selected category (caller derives).
 *   onSelect      — (id) => void; category tab tapped.
 *   onAddCategory — () => void; only used when editable=true.
 *   editable      — show strikethrough for inactive cats + "+ Категория".
 *   renderItem    — (item) => ReactNode; per-row renderer.
 *   emptyText     — shown when items.length === 0.
 *   headerSlot    — optional ReactNode above the right pane.
 *   bottomInset   — px of padding-bottom for the pane. Use to reserve
 *                   space for whatever floats over it — a BottomSheet
 *                   (~200), a FAB (~80), etc. Passed as a CSS custom
 *                   property so the caller doesn't need to duplicate
 *                   any host-specific CSS.
 */
export default function MenuTwoPanel({
  categories,
  selectedId = null,
  items = [],
  onSelect,
  onAddCategory,
  editable = false,
  renderItem,
  emptyText = 'Нет позиций',
  headerSlot = null,
  bottomInset = 12,
}) {
  const cats = useMemo(() => categories || [], [categories])

  const paneRef = useRef(null)
  const firstCopyRef = useRef(null)
  const [loopEnabled, setLoopEnabled] = useState(false)

  // Reset scroll on category change — otherwise the pane's scrollTop
  // is preserved across categories and users land mid-list.
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0
  }, [selectedId])

  // Decide whether to duplicate the items list for seamless-loop scroll:
  // only when the first copy is actually taller than the pane. Otherwise
  // the second copy would sit visibly below as an ugly repeat.
  useEffect(() => {
    const pane = paneRef.current
    const list = firstCopyRef.current
    if (!items.length || !pane || !list) {
      // Nothing to loop. External DOM state → React state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoopEnabled(false)
      return
    }
    const measure = () => {
      // +20px buffer to avoid flapping on/off near the threshold.
      setLoopEnabled(list.offsetHeight > pane.clientHeight + 20)
    }
    // ResizeObserver fires once on observe, so no synchronous initial
    // call needed — the RO callback runs asynchronously, outside the
    // effect body, so the set-state-in-effect rule doesn't apply.
    const ro = new ResizeObserver(measure)
    ro.observe(pane)
    ro.observe(list)
    return () => ro.disconnect()
  }, [items])

  // Seam jump: when scrollTop crosses the top of the second copy, we
  // silently rewind by one first-copy height. Native scroll momentum is
  // preserved on both iOS and Android across a direct scrollTop write,
  // so the user experiences a continuous scroll. list.offsetTop is
  // measured against the pane thanks to inline position:relative below.
  const onScroll = useCallback(() => {
    if (!loopEnabled) return
    const pane = paneRef.current
    const list = firstCopyRef.current
    if (!pane || !list) return
    const seam = list.offsetTop + list.offsetHeight
    if (pane.scrollTop >= seam) {
      pane.scrollTop -= list.offsetHeight
    }
  }, [loopEnabled])

  return (
    <div
      className="mtp-wrap"
      style={{ '--mtp-bottom-inset': `${bottomInset}px` }}
    >
      {/* LEFT — categories rail */}
      <nav className="mtp-rail" role="tablist" aria-label="Категории">
        {cats.map((cat) => {
          const isActive = cat.id === selectedId
          const cls = [
            'mtp-cat',
            isActive ? 'mtp-cat--active' : '',
            editable && !cat.is_active ? 'mtp-cat--inactive' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={cat.id}
              type="button"
              className={cls}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect?.(cat.id)}
            >
              <span className="mtp-cat-text">{cat.title}</span>
              {editable && !cat.is_active ? (
                <span className="mtp-cat-dot" aria-hidden>
                  ●
                </span>
              ) : null}
            </button>
          )
        })}

        {editable && onAddCategory ? (
          <button
            type="button"
            className="mtp-cat mtp-cat--add"
            onClick={onAddCategory}
          >
            + Категория
          </button>
        ) : null}
      </nav>

      {/* RIGHT — content pane.
          position:relative here so list.offsetTop is measured against
          the pane (its nearest positioned ancestor) rather than climbing
          to body — which would give useless coordinates for the seam. */}
      <div
        className="mtp-pane"
        ref={paneRef}
        onScroll={onScroll}
        style={{ position: 'relative' }}
      >
        {headerSlot}
        {items.length === 0 ? (
          <div className="mtp-empty">{emptyText}</div>
        ) : (
          <>
            <div className="mtp-items" ref={firstCopyRef}>
              {items.map((item) => renderItem?.(item))}
            </div>
            {loopEnabled && (
              <div className="mtp-items" aria-hidden="true">
                {items.map((item) => renderItem?.(item))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}