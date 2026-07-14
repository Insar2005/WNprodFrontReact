/**
 * Breadcrumbs for menu tree navigation.
 *
 * Left-aligned, horizontally scrollable when the path is long (scrollbar
 * hidden). The last segment is the current node — bold, not a button.
 * Earlier segments are buttons that jump up the tree.
 *
 * Renders nothing when there are fewer than 2 labels (a single root
 * category needs no breadcrumb — its title is the H2 right below).
 *
 * Props:
 *   labels — string[] from labelsForPath(roots, path)
 *   onNav  — (idx) => void; tapped a non-current segment at index idx
 */
export default function Breadcrumbs({ labels = [], onNav }) {
  if (labels.length < 2) return null
  const lastIdx = labels.length - 1
  return (
    <nav className="mbc" aria-label="Навигация по категориям">
      {labels.map((label, i) => {
        const current = i === lastIdx
        return (
          <span className="mbc-seg" key={i}>
            {i > 0 && (
              <span className="mbc-sep" aria-hidden="true">
                ›
              </span>
            )}
            {current ? (
              <span className="mbc-current" aria-current="page">
                {label}
              </span>
            ) : (
              <button
                type="button"
                className="mbc-link"
                onClick={() => onNav?.(i)}
              >
                {label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}