/**
 * Two-panel menu layout: vertical category list on the left,
 * scrollable items list on the right.
 *
 * Used by both MenuEditorView (mode="edit") and OrderBuilderView
 * (mode="pick"). Renders the supplied `itemSlot` for each item, so each
 * caller controls the row UI (MenuItemRow vs MenuPickRow with quantity
 * badge, etc).
 *
 * Props
 *   categories   — sorted array of category objects (already filtered).
 *   selectedId   — currently selected category id (controlled).
 *   items        — items of the selected category (caller derives via useMemo).
 *   onSelect     — (id) => void; called when a category tab is tapped.
 *   onAddCategory — () => void; shown when editable=true ("+ Категория").
 *   editable     — show the inactive-category strikethrough + "+ Категория" button.
 *   itemSlot     — (item) => ReactNode; per-item row renderer.
 *   emptyText    — text shown when items.length === 0 (default: 'Нет позиций').
 *   headerSlot   — optional ReactNode rendered above the right pane
 *                  (used by the editor for the "Изменить" link + category name).
 */
export default function MenuTwoPanel({
  categories,
  selectedId = null,
  items = [],
  onSelect,
  onAddCategory,
  editable = false,
  itemSlot,
  emptyText = 'Нет позиций',
  headerSlot = null,
}) {
  return (
    <div className="mtp-wrap">
      {/* LEFT — categories rail */}
      <nav className="mtp-rail" role="tablist" aria-label="Категории">
        {categories.map((cat) => {
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
            className="mtp-cat mtp-cat--add"
            onClick={() => onAddCategory?.()}
            aria-label="Новая категория"
          >
            + Категория
          </button>
        )}
      </nav>

      {/* RIGHT — items pane */}
      <div className="mtp-pane">
        {headerSlot}
        {items.length === 0 ? (
          <div className="mtp-empty">
            <p className="empty-text">{emptyText}</p>
          </div>
        ) : (
          <div className="mtp-items">{items.map((it) => itemSlot(it))}</div>
        )}
      </div>
    </div>
  )
}