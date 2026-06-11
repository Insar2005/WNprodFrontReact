/**
 * Horizontal scrollable category chips. (Was CategoryChips.vue.)
 * - $emit('select', id) → onSelect(id); $emit('add') → onAdd().
 * - editable controls the "+" chip (hidden in order-builder).
 */
export default function CategoryChips({
  categories,
  selectedId = null,
  editable = true,
  onSelect,
  onAdd,
}) {
  return (
    <div className="chips" role="tablist">
      {categories.map((cat) => {
        const cls = [
          'chip',
          cat.id === selectedId ? 'chip--active' : '',
          !cat.is_active ? 'chip--inactive-cat' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={cat.id}
            className={cls}
            role="tab"
            aria-selected={cat.id === selectedId}
            onClick={() => onSelect?.(cat.id)}
          >
            <span className="chip-text">{cat.title}</span>
            {!cat.is_active && (
              <span className="chip-dot" title="Скрыта">
                ●
              </span>
            )}
          </button>
        )
      })}

      {editable && (
        <button className="chip chip--add" onClick={() => onAdd?.()} aria-label="Новая категория">
          +
        </button>
      )}
    </div>
  )
}