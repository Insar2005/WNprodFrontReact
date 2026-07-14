import { PlusIcon } from './menuIcons'

/**
 * Uppercase section label — e.g. "Без подкатегории" above loose items
 * when a category has both subcategories and its own direct items.
 */
export function SectionLabel({ children }) {
  return <div className="msec-label">{children}</div>
}

/**
 * Dashed "+ Подкатегория" button — creates a child category under the
 * current node. Used in MenuEditor only (editable mode).
 *
 * Props:
 *   onClick — () => void
 *   label   — button text (default "Подкатегория")
 */
export function AddSubcatButton({ onClick, label = 'Подкатегория' }) {
  return (
    <button type="button" className="madd-sub" onClick={onClick}>
      <PlusIcon width={18} height={18} />
      <span>{label}</span>
    </button>
  )
}