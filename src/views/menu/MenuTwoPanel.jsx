import { useMemo } from 'react'

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

      {/* RIGHT — content pane */}
      <div className="mtp-pane">
        {headerSlot}
        {items.length === 0 ? (
          <div className="mtp-empty">{emptyText}</div>
        ) : (
          <div className="mtp-items">
            {items.map((item) => renderItem?.(item))}
          </div>
        )}
      </div>
    </div>
  )
}