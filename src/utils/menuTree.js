/**
 * Menu tree helpers.
 *
 * The store keeps categories and items as FLAT arrays (single source of
 * truth, easy to mutate optimistically). The UI, however, needs a nested
 * tree for drill-down navigation and breadcrumbs. These pure helpers
 * bridge the two: build a tree on demand (memoized in views), and walk
 * it by `path` — an array of category ids from a root category down to
 * the currently-open node.
 *
 * ── Node shape ──────────────────────────────────────────────────────
 *   {
 *     ...category,          // all original fields (id, title, parent_id, …)
 *     children: TreeNode[], // child categories, sorted by position
 *     items: MenuItem[],    // items directly in THIS category, by position
 *   }
 *
 * Design decisions:
 *   • The tree is DERIVED, never stored. Views build it via useMemo on
 *     raw `categories`/`items` so reactivity stays correct (see the
 *     reactivity note in stores/menu.js).
 *   • `parent_id == null` → root category. Anything else → subcategory.
 *   • Depth is unbounded. A cycle guard (_MAX_DEPTH) protects traversal
 *     against corrupt data where a parent chain never reaches a root.
 *   • Orphans (parent_id points at a missing/inactive category) are
 *     promoted to roots so they never vanish from the UI.
 * ─────────────────────────────────────────────────────────────────────
 */

const _MAX_DEPTH = 100

/**
 * Build a nested tree from flat categories + items.
 *
 * @param {Array} categories - flat category list (each may have parent_id)
 * @param {Array} items - flat item list (each has category_id)
 * @returns {Array} roots - top-level tree nodes, sorted by position
 */
export function buildTree(categories = [], items = []) {
  // 1. Wrap every category in a node with empty children/items.
  const byId = new Map()
  for (const c of categories) {
    byId.set(c.id, { ...c, children: [], items: [] })
  }

  // 2. Bucket items under their category (skip items whose category is
  //    gone — they'd be invisible anyway).
  for (const it of items) {
    const node = byId.get(it.category_id)
    if (node) node.items.push(it)
  }

  // 3. Link children to parents; collect roots. A category is a root if
  //    it has no parent_id OR its parent_id doesn't resolve (orphan
  //    promotion — better a stray root than a disappeared category).
  const roots = []
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }

  // 4. Sort children and items by position at every level.
  const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)
  const sortRec = (node) => {
    node.children.sort(byPosition)
    node.items.sort(byPosition)
    node.children.forEach(sortRec)
  }
  roots.sort(byPosition)
  roots.forEach(sortRec)

  return roots
}

/**
 * Resolve a node by path (array of ids from a root down).
 * Returns null if any segment doesn't resolve.
 *
 * @param {Array} roots - tree roots from buildTree
 * @param {string[]} path - ids from root to target (inclusive)
 */
export function nodeByPath(roots, path) {
  if (!path || path.length === 0) return null
  let node = roots.find((c) => c.id === path[0]) || null
  for (let i = 1; i < path.length && node; i++) {
    node = (node.children || []).find((c) => c.id === path[i]) || null
  }
  return node
}

/**
 * Human-readable labels along a path, for breadcrumbs.
 * Stops early if a segment doesn't resolve.
 *
 * @returns {string[]} e.g. ["Напитки", "Холодные", "Соки"]
 */
export function labelsForPath(roots, path) {
  const out = []
  if (!path || path.length === 0) return out
  let node = roots.find((c) => c.id === path[0]) || null
  for (let i = 0; i < path.length; i++) {
    node =
      i === 0
        ? roots.find((c) => c.id === path[0])
        : (node.children || []).find((c) => c.id === path[i])
    if (!node) break
    out.push(node.title ?? node.name ?? '')
  }
  return out
}

/**
 * Count ALL items in a subtree (this node + every descendant).
 */
export function countItems(node) {
  if (!node) return 0
  let c = (node.items || []).length
  for (const ch of node.children || []) c += countItems(ch)
  return c
}

/**
 * Build the full path (array of ids from root) to a given category id,
 * by walking up parent_id links in the FLAT category list.
 *
 * Used by the search flow: a result carries only category_id (a leaf),
 * but navigation needs the whole path so breadcrumbs and drill-down
 * state are correct.
 *
 * @param {Array} categories - flat category list
 * @param {string} categoryId - target leaf category
 * @returns {string[]} path from root to categoryId, or [] if not found
 */
export function pathToCategory(categories = [], categoryId) {
  if (!categoryId) return []
  const byId = new Map(categories.map((c) => [c.id, c]))
  const rev = []
  let cursor = byId.get(categoryId)
  let depth = 0
  while (cursor && depth < _MAX_DEPTH) {
    rev.push(cursor.id)
    const parentId = cursor.parent_id ?? null
    if (!parentId) break
    cursor = byId.get(parentId)
    depth++
  }
  return rev.reverse()
}

/**
 * Pluralized "N подкатегорий · K позиций" meta line for a node.
 * K is recursive (whole subtree). Subs part omitted when there are none.
 *
 * @param {Object} node - tree node
 * @param {Function} plural - (n, one, few, many) => string
 */
export function nodeMeta(node, plural) {
  const subs = (node.children || []).length
  const items = countItems(node)
  const itemsPart = `${items} ${plural(items, 'позиция', 'позиции', 'позиций')}`
  if (subs > 0) {
    const subsPart = `${subs} ${plural(subs, 'подкатегория', 'подкатегории', 'подкатегорий')}`
    return `${subsPart} · ${itemsPart}`
  }
  return itemsPart
}