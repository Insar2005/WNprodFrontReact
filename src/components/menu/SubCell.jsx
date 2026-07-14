import { ChevronRight } from './menuIcons'
import { nodeMeta } from '@/utils/menuTree'

/**
 * Subcategory cell — a tappable card showing a child category's name, its
 * meta line ("N подкатегорий · K позиций"), and a drilldown chevron.
 *
 * Used in the right pane of both MenuEditor and OrderBuilder to represent
 * a child category the user can drill into.
 *
 * Props:
 *   node    — tree node (has children/items so nodeMeta can count)
 *   plural  — (n, one, few, many) => string; passed through to nodeMeta
 *   onOpen  — (id) => void; card tapped → drill into this subcategory
 */
export default function SubCell({ node, plural, onOpen }) {
  return (
    <button
      type="button"
      className="msub"
      onClick={() => onOpen?.(node.id)}
    >
      <span className="msub-body">
        <span className="msub-name">{node.title ?? node.name}</span>
        <span className="msub-meta">{nodeMeta(node, plural)}</span>
      </span>
      <ChevronRight className="msub-chev" />
    </button>
  )
}