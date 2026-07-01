import { create } from 'zustand'
import { menuApi } from '@/api/menu'

// Shared timer handle for the highlightItem auto-clear. Lives in module
  // scope so nested highlightItem() calls can cancel the previous timeout
  // without threading a ref through the store state.
  let _highlightTimer = null
/**
 * Menu store: categories + items for the current workplace.
 * Tree is loaded once via getTree(); single-entity mutations update locally.
 *
 * ── Porting note: parametrized getters & reactivity ─────────────────
 * In Vue several getters were `computed(() => (id) => ...)` — a computed
 * that returns a function, so a component could call
 * `menu.itemsByCategory(catId)` and stay reactive.
 *
 * In Zustand these become plain methods: itemsByCategory(catId). They
 * recompute on every call (cheap — array filter). The subtlety is
 * REACTIVITY in components:
 *   - Calling get().itemsByCategory(id) inside an action: fine, always
 *     reads current state.
 *   - In a component you must subscribe to the underlying state so the
 *     component re-renders when it changes. Do this by selecting the raw
 *     arrays and deriving with useMemo, e.g.:
 *
 *       const items = useMenuStore(s => s.items)
 *       const catItems = useMemo(
 *         () => items.filter(i => i.category_id === catId)
 *                    .sort((a,b) => a.position - b.position),
 *         [items, catId],
 *       )
 *
 *   Selecting s => s.itemsByCategory(catId) directly would return a NEW
 *   array each render and can cause needless re-renders, so prefer the
 *   useMemo-on-raw-state pattern in views. The methods below stay handy
 *   for use inside other store actions.
 * ─────────────────────────────────────────────────────────────────────
 */
export const useMenuStore = create((set, get) => ({
  // Categories list. Each carries `items: []` from the tree response; we
  // flatten items into a separate array to make per-item lookups O(1).
  categories: [],
  items: [],
  isLoading: false,
  error: null,

  /** Currently-selected category id in the editor UI. */
  selectedCategoryId: null,
  /**
   * Item id currently "highlighted" — used by the search-result flow so
   * that after picking a found dish, the row in its category pulses
   * briefly to show the waiter where it landed. Auto-clears after ~2s
   * via a timer set in highlightItem(). Reset on category switch too so
   * a stale highlight doesn't come back when navigating around.
   */
  highlightedItemId: null,
  // === getters (were: computed) ===

  allCategories: () =>
    [...get().categories].sort((a, b) => a.position - b.position),

  activeCategories: () => get().allCategories().filter((c) => c.is_active),

  categoryById: (id) => get().categories.find((c) => c.id === id) ?? null,

  itemsByCategory: (categoryId) =>
    [...get().items]
      .filter((i) => i.category_id === categoryId)
      .sort((a, b) => a.position - b.position),

  itemById: (id) => get().items.find((i) => i.id === id) ?? null,

  totalItemCount: () => get().items.length,

  /** Items of the currently-selected category. */
  selectedItems: () => {
    const id = get().selectedCategoryId
    return id ? get().itemsByCategory(id) : []
  },

  /** Selected category object. */
  selectedCategory: () => {
    const id = get().selectedCategoryId
    return id ? get().categoryById(id) : null
  },

  // === actions ===

  fetchAll: async (workplaceId, { activeOnly = false } = {}) => {
    if (!workplaceId) {
      get().reset()
      return
    }
    set({ isLoading: true, error: null })
    try {
      const tree = await menuApi.getTree(workplaceId, { activeOnly })
      const categories = tree.map((c) => {
        const { items: _items, ...cat } = c
        return cat
      })
      const items = tree.flatMap((c) => c.items || [])
      set({ categories, items })

      // Preserve selection if still valid; else pick first.
      let selectedCategoryId = get().selectedCategoryId
      if (
        selectedCategoryId &&
        !categories.find((c) => c.id === selectedCategoryId)
      ) {
        selectedCategoryId = null
      }
      if (!selectedCategoryId && get().allCategories().length > 0) {
        selectedCategoryId = get().allCategories()[0].id
      }
      set({ selectedCategoryId })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

    selectCategory: (id) =>
    // Clear any pending highlight when the user changes category
    // themselves — otherwise a stale pulse could reappear if they
    // switched away and back within the 2s window.
    set({ selectedCategoryId: id, highlightedItemId: null }),
 
  /**
   * Highlight an item briefly (pulse animation in its row) so a search
   * result the user picked is easy to spot in its category. Consumers:
   * OrderBuilderView calls this from onPickFromSearch. The timer is
   * intentionally kept in a module-local variable so consecutive calls
   * cancel the previous timer instead of overlapping.
   */
highlightItem: (id) => {
    set({ highlightedItemId: id })
    if (_highlightTimer) clearTimeout(_highlightTimer)
    _highlightTimer = setTimeout(() => {
      // Only clear if we're still highlighting THIS id — a fresh call
      // in the meantime should have its own 2s window.
      if (get().highlightedItemId === id) {
        set({ highlightedItemId: null })
      }
      _highlightTimer = null
    }, 2000)
  },

  // ----- Categories -----

  createCategory: async (workplaceId, body) => {
    const cat = await menuApi.createCategory(workplaceId, body)
    // backend returns category with `items: []`; strip
    const { items: _items, ...rest } = cat
    set({ categories: [...get().categories, rest] })
    if (!get().selectedCategoryId) set({ selectedCategoryId: rest.id })
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
      set({ categories: get().categories.map((c) => (c.id === id ? rest : c)) })
    } catch (e) {
      set({ categories: get().categories.map((c) => (c.id === id ? prev : c)) })
      throw e
    }
  },

  removeCategory: async (id) => {
    await menuApi.removeCategory(id)
    set({
      categories: get().categories.filter((c) => c.id !== id),
      items: get().items.filter((i) => i.category_id !== id),
    })
    if (get().selectedCategoryId === id) {
      set({ selectedCategoryId: get().allCategories()[0]?.id ?? null })
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
    set({ items: items.map((i, n) => (n === idx ? { ...prev, ...patch } : i)) })
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
   * Search across all items by title (case-insensitive).
   * Used by editor & OrderBuilder.
   */
  searchItems: (query) => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return []
    return get()
      .items.filter((i) => i.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
  },

  reset: () => {
    set({
      categories: [],
      items: [],
      selectedCategoryId: null,
      error: null,
    })
  },
}))