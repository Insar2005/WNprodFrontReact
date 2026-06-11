/**
 * Hall tab strip for the map. (Was HallSwitcher.vue.)
 * $emit('select', id) → onSelect(id).
 */
export default function HallSwitcher({ halls, activeId = null, onSelect }) {
  return (
    <div className="hsw-switcher">
      {halls.map((h) => (
        <button
          key={h.id}
          className={h.id === activeId ? 'hsw-tab hsw-tab--active' : 'hsw-tab'}
          onClick={() => onSelect?.(h.id)}
        >
          {h.name}
        </button>
      ))}
    </div>
  )
}