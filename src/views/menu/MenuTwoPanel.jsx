import { useMemo } from 'react'

/**
 * Two-panel menu layout: vertical category rail on the left + scrollable
 * content pane on the right. Replaces the horizontal CategoryChips
 * idiom on screens that opt in.
 *
 * Used by both MenuEditorView and OrderBuilderView. The caller supplies
 * `renderItem(item)` so each screen controls its own row UI — same
 * MenuItemRow component, just different modes (edit vs pick) and
 * handlers.
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
 * Props
 *   categories    — sorted array of category objects (already filtered
 *                   appropriately — editor passes all, pick passes
 *                   only active).
 *   selectedId    — currently-selected category id (controlled).
 *   items         — items of the selected category (caller derives).
 *   onSelect      — (id) => void; category tab tapped.
 *   onAddCategory — () => void; only used when `editable=true`. Renders
 *                   the "+ Категория" button at the rail's end.
 *   editable      — show the strikethrough on inactive categories and
 *                   the "+ Категория" tail button (editor only).
 *   renderItem    — (item) => ReactNode; per-row renderer. Caller decides
 *                   whether to use MenuItemRow in edit or pick mode.
 *   emptyText     — shown when items.length === 0.
 *   headerSlot    — optional ReactNode above the right pane (e.g. the
 *                   "Изменить" link in the editor).
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
}) {
  // Stable list of rendered categories — sorted by position is the caller's
  // job; we just trust the order. Use useMemo only if needed; here it's a
  // pass-through.
  const cats = useMemo(() => categories || [], [categories])

  return (
    <div className="mtp-wrap">
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
              {editable && !cat.is_active && (
                <span className="mtp-cat-dot" aria-hidden="true">
                  ●
                </span>
              )}
            </button>
          )
        })}

        {editable && (
          <button
            type="button"
            className="mtp-cat-add"
            onClick={() => onAddCategory?.()}
            aria-label="Новая категория"
          >
            + Категория
          </button>
        )}
      </nav>

      {/* RIGHT — content pane */}
      <div className="mtp-pane">
        {headerSlot}
        {items.length === 0 ? (
          <div className="mtp-empty">
            <p className="empty-text">{emptyText}</p>
          </div>
        ) : (
          <div className="mtp-items">{items.map((it) => renderItem(it))}</div>
        )}
      </div>
    </div>
  )
}