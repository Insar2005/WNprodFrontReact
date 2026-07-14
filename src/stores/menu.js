import { create } from 'zustand'
import { menuApi } from '@/api/menu'
import { matchesMenuQuery } from '@/utils/menuSearch'
import { pathToCategory } from '@/utils/menuTree'

// Shared timer handle for the highlightItem auto-clear. Lives in module
// scope so nested highlightItem() calls can cancel the previous timeout
// without threading a ref through the store state.
let _highlightTimer = null

/**
 * Menu store: categories + items for the current workplace.
 * Tree is loaded once via fetchAll(); single-entity mutations update locally.
 *
 * -- Navigation model (July 2026 -- tree redesign) -------------------
 * Categories form a tree (menu_categories.parent_id). The UI navigates
 * by `path`: an array of category ids from a ROOT category down to the
 * currently-open node. path=['drinks'] is the root; drilling into a
 * subcategory gives path=['drinks','cold']; breadcrumbs jump back up.
 *
 * `selectedCategoryId` remains a REAL state field (the last path segment),
 * kept in sync with `path` on every navigation. This preserves backward
 * compatibility: existing views/modals read it as a plain value
 * (useMenuStore(s => s.selectedCategoryId)) and select via
 * selectCategory(id) -- both keep working unchanged.
 *
 * The nested tree itself is NOT stored -- it's derived in views via
 * useMemo(buildTree, [categories, items]). The store holds only the flat
 * arrays (single source of truth) plus `path` + mirrored selectedCategoryId.
 *
 * -- Reactivity note -------------------------------------------------
 * Getters like itemsByCategory(id) recompute per call (cheap filter). In
 * components, subscribe to raw arrays and derive with useMemo -- do NOT
 * select s => s.itemsByCategory(id) directly (new array each render ->
 * needless re-renders). The methods are for use inside store actions.
 * --------------------------------------------------------------------
 */

// Derive the mirrored selectedCategoryId (last path segment) from a path.
const _lastOf = (path) => (path.length ? path[path.length - 1] : null)

export const useMenuStore = create((set, get) => {
  // Apply a new path AND its mirrored selectedCategoryId in one set().
  // Every navigation goes through here so the two never drift apart.
  const setPathState = (path, extra = {}) => {
    const p = Array.isArray(path) ? path : []
    set({ path: p, selectedCategoryId: _lastOf(p), ...extra })
  }

  return {
    categories: [],
    items: [],
    isLoading: false,
    error: null,

    /**
     * Navigation path: category ids from a root down to the open node.
     * Empty = nothing selected yet.
     */
    path: [],

    /**
     * Last path segment, mirrored as a real field for backward compat.
     * Do not set directly -- kept in sync via setPathState.
     */
    selectedCategoryId: null,

    /**
     * Item id currently "highlighted" -- the search-result flow pulses the
     * picked dish's row briefly. Auto-clears after ~2s via highlightItem().
     */
    highlightedItemId: null,

    // === getters (were: computed) ===

    allCategories: () =>
      [...get().categories].sort((a, b) => a.position - b.position),

    activeCategories: () => get().allCategories().filter((c) => c.is_active),

    /** Root categories only (parent_id == null), sorted. For the rail. */
    rootCategories: () =>
      get()
        .allCategories()
        .filter((c) => (c.parent_id ?? null) === null),

    activeRootCategories: () =>
      get().rootCategories().filter((c) => c.is_active),

    /** Direct children of a category id, sorted. */
    childrenOf: (parentId) =>
      get()
        .allCategories()
        .filter((c) => (c.parent_id ?? null) === parentId),

    categoryById: (id) => get().categories.find((c) => c.id === id) ?? null,

    itemsByCategory: (categoryId) =>
      [...get().items]
        .filter((i) => i.category_id === categoryId)
        .sort((a, b) => a.position - b.position),

    itemById: (id) => get().items.find((i) => i.id === id) ?? null,

    totalItemCount: () => get().items.length,

    /** Items of the currently-selected category (last path segment). */
    selectedItems: () => {
      const id = get().selectedCategoryId
      return id ? get().itemsByCategory(id) : []
    },

    /** Selected category object. */
    selectedCategory: () => {
      const id = get().selectedCategoryId
      return id ? get().categoryById(id) : null
    },

    // === navigation actions ===

    /**
     * Set the full navigation path. Clears any pending highlight -- a stale
     * pulse shouldn't reappear when the user navigates themselves.
     */
    setPath: (path) => setPathState(path, { highlightedItemId: null }),

    /**
     * Select a category. Backward-compatible replacement for the old
     * selectCategory(id): callers picking a top-level category keep
     * working. A NON-root id resolves to its full path so drill-down and
     * breadcrumbs stay correct (used by the search-result flow).
     */
    selectCategory: (id) => {
      if (!id) {
        setPathState([], { highlightedItemId: null })
        return
      }
      const cat = get().categoryById(id)
      if (!cat || (cat.parent_id ?? null) === null) {
        setPathState([id], { highlightedItemId: null })
      } else {
        const full = pathToCategory(get().categories, id)
        setPathState(full.length ? full : [id], { highlightedItemId: null })
      }
    },

    /** Drill one level deeper into a child category. */
    drillInto: (childId) => {
      if (!childId) return
      setPathState([...get().path, childId], { highlightedItemId: null })
    },

    /** Jump to breadcrumb segment index (0-based), truncating the path. */
    navToBreadcrumb: (idx) => {
      const p = get().path
      if (idx < 0 || idx >= p.length) return
      setPathState(p.slice(0, idx + 1), { highlightedItemId: null })
    },

    /**
     * Highlight an item briefly so a picked search result is easy to spot.
     * Timer is module-local so consecutive calls cancel the previous one.
     */
    highlightItem: (id) => {
      set({ highlightedItemId: id })
      if (_highlightTimer) clearTimeout(_highlightTimer)
      _highlightTimer = setTimeout(() => {
        if (get().highlightedItemId === id) {
          set({ highlightedItemId: null })
        }
        _highlightTimer = null
      }, 2000)
    },

    // === data load ===

    fetchAll: async (workplaceId, { activeOnly = false } = {}) => {
      if (!workplaceId) {
        get().reset()
        return
      }
      set({ isLoading: true, error: null })
      try {
        const tree = await menuApi.getTree(workplaceId, { activeOnly })
        // Backend returns a flat list of categories, each carrying its own
        // items array. Flatten items for O(1) lookups; parent_id lives on
        // each category for tree building in views.
        const categories = tree.map((c) => {
          const { items: _items, ...cat } = c
          return cat
        })
        const items = tree.flatMap((c) => c.items || [])
        set({ categories, items })

        // Preserve current path if its head is a valid root; else pick the
        // first root. Trim now-missing deeper segments.
        let path = get().path
        const head = path[0]
        const headValid = head && categories.find((c) => c.id === head)
        if (!headValid) {
          const firstRoot = get().rootCategories()[0]
          path = firstRoot ? [firstRoot.id] : []
        } else {
          const valid = []
          for (const id of path) {
            if (categories.find((c) => c.id === id)) valid.push(id)
            else break
          }
          path = valid.length ? valid : [head]
        }
        setPathState(path)
      } catch (e) {
        set({ error: e.message })
        throw e
      } finally {
        set({ isLoading: false })
      }
    },

    // ----- Categories -----

    createCategory: async (workplaceId, body) => {
      const cat = await menuApi.createCategory(workplaceId, body)
      const { items: _items, ...rest } = cat
      set({ categories: [...get().categories, rest] })
      // If nothing selected yet and this is a root category, select it.
      if (get().path.length === 0 && (rest.parent_id ?? null) === null) {
        setPathState([rest.id])
      }
      return rest
    },

    updateCategory: async (id, patch) => {
      const cats = get().categories
      const idx = cats.findIndex((c) => c.id === id)
      if (idx < 0) return
      const prev = cats[idx]
      set({
        categories: cats.map((c, i) => (i === idx ? { ...prev, ...patch } : c)),
      })
      try {
        const updated = await menuApi.updateCategory(id, patch)
        const { items: _items, ...rest } = updated
        set({
          categories: get().categories.map((c) => (c.id === id ? rest : c)),
        })
      } catch (e) {
        set({
          categories: get().categories.map((c) => (c.id === id ? prev : c)),
        })
        throw e
      }
    },

    removeCategory: async (id) => {
      await menuApi.removeCategory(id)
      // Collect the whole subtree (id + descendants) -- backend CASCADEs,
      // mirror that locally so items under removed subcats also drop.
      const cats = get().categories
      const toRemove = new Set([id])
      let grew = true
      while (grew) {
        grew = false
        for (const c of cats) {
          const pid = c.parent_id ?? null
          if (pid && toRemove.has(pid) && !toRemove.has(c.id)) {
            toRemove.add(c.id)
            grew = true
          }
        }
      }
      set({
        categories: cats.filter((c) => !toRemove.has(c.id)),
        items: get().items.filter((i) => !toRemove.has(i.category_id)),
      })
      // If the removed subtree was on the current path, back up to the
      // nearest surviving ancestor, else the first root.
      const path = get().path
      if (path.some((pid) => toRemove.has(pid))) {
        const survived = []
        for (const pid of path) {
          if (toRemove.has(pid)) break
          survived.push(pid)
        }
        const firstRoot = get().rootCategories()[0]
        setPathState(
          survived.length ? survived : firstRoot ? [firstRoot.id] : [],
        )
      }
    },

    reorderCategories: async (workplaceId, ids) => {
      const prev = [...get().categories]
      const byId = new Map(prev.map((c) => [c.id, c]))
      const next = ids
        .map((id, position) => {
          const c = byId.get(id)
          return c ? { ...c, position } : null
        })
        .filter(Boolean)
      // ids covers only one sibling group; keep categories not in the list.
      for (const c of prev) {
        if (!next.find((n) => n.id === c.id)) next.push(c)
      }
      set({ categories: next })
      try {
        await menuApi.reorderCategories(workplaceId, ids)
      } catch (e) {
        set({ categories: prev })
        throw e
      }
    },

    // ----- Items -----

    createItem: async (categoryId, body) => {
      const item = await menuApi.createItem(categoryId, body)
      set({ items: [...get().items, item] })
      return item
    },

    updateItem: async (id, patch) => {
      const items = get().items
      const idx = items.findIndex((i) => i.id === id)
      if (idx < 0) return
      const prev = items[idx]
      set({
        items: items.map((i, n) => (n === idx ? { ...prev, ...patch } : i)),
      })
      try {
        const updated = await menuApi.updateItem(id, patch)
        set({ items: get().items.map((i) => (i.id === id ? updated : i)) })
      } catch (e) {
        set({ items: get().items.map((i) => (i.id === id ? prev : i)) })
        throw e
      }
    },

    removeItem: async (id) => {
      await menuApi.removeItem(id)
      set({ items: get().items.filter((i) => i.id !== id) })
    },

    reorderItems: async (categoryId, ids) => {
      const prev = [...get().items]
      const byId = new Map(prev.map((i) => [i.id, i]))
      const others = prev.filter((i) => i.category_id !== categoryId)
      const reordered = ids
        .map((id, position) => {
          const i = byId.get(id)
          return i ? { ...i, position } : null
        })
        .filter(Boolean)
      set({ items: [...others, ...reordered] })
      try {
        await menuApi.reorderItems(categoryId, ids)
      } catch (e) {
        set({ items: prev })
        throw e
      }
    },

    /**
     * Search across all items by title. Prefix-per-word matching:
     * "ga" matches word starts but not mid-word. See utils/menuSearch.
     */
    searchItems: (query) => {
      const q = (query || '').trim()
      if (!q) return []
      return get()
        .items.filter((i) => matchesMenuQuery(i.title, q))
        .sort((a, b) => a.title.localeCompare(b.title))
    },

    reset: () => {
      set({
        categories: [],
        items: [],
        path: [],
        selectedCategoryId: null,
        error: null,
      })
    },
  }
})