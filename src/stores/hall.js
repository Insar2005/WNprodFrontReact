import { create } from 'zustand'
import { hallsApi, tablesApi, layoutsApi } from '@/api/halls'
import { clearHallViewport } from '@/utils/hallViewport'

/**
 * Hall store: halls + tables of the current workplace.
 *
 * The map is loaded as a tree (halls each containing tables) but flattened
 * here for O(1) lookups. activeHallId selects which hall is currently visible.
 *
 * Tables manipulation lives here too — but the editor decides WHEN to call.
 * In the working view, mutations are not exposed via the UI.
 *
 * Reactivity reminder (same as menu store): in components, select raw
 * arrays (s => s.tables) and derive with useMemo. The lookup methods
 * (tableById, tablesOfHall) are for use inside actions / one-off reads.
 */
export const useHallStore = create((set, get) => ({
  halls: [],
  tables: [],
  // Layouts (table arrangement templates) for the currently active hall.
  // Loaded lazily — only when the user opens the templates panel; reset
  // whenever the active hall changes.
  layouts: [],
  activeHallId: null,
  isLoading: false,
  error: null,

  // === getters (were: computed) ===

  sortedHalls: () =>
    [...get().halls].sort((a, b) => a.position - b.position),

  activeHall: () =>
    get().halls.find((h) => h.id === get().activeHallId) ?? null,

  tablesOfActive: () => {
    const id = get().activeHallId
    return id ? get().tables.filter((t) => t.hall_id === id) : []
  },

  tablesOfHall: (hallId) => get().tables.filter((t) => t.hall_id === hallId),

  tableById: (id) => get().tables.find((t) => t.id === id) ?? null,

  tableByOrder: (orderId) =>
    get().tables.find((t) => t.order_id === orderId) ?? null,

  isEmpty: () => get().halls.length === 0,

  // === actions ===

  fetchAll: async (workplaceId) => {
    if (!workplaceId) {
      get().reset()
      return
    }
    set({ isLoading: true, error: null })
    try {
      const tree = await hallsApi.listForWorkplace(workplaceId)
      const halls = tree.map((h) => {
        const { tables: _t, ...hall } = h
        return hall
      })
      const tables = tree.flatMap((h) => h.tables || [])
      set({ halls, tables })

      // Preserve active selection if still valid; else pick first.
      let activeHallId = get().activeHallId
      if (activeHallId && !halls.find((h) => h.id === activeHallId)) {
        activeHallId = null
      }
      if (!activeHallId && get().sortedHalls().length > 0) {
        activeHallId = get().sortedHalls()[0].id
      }
      set({ activeHallId })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  setActiveHall: (id) => {
    if (get().activeHallId !== id) {
      // Layouts are per-hall — reset so a stale list from the previous hall
      // doesn't briefly flash before the new fetch resolves.
      set({ layouts: [] })
    }
    set({ activeHallId: id })
  },

  // ----- Halls CRUD -----

  createHall: async (workplaceId, body) => {
    const hall = await hallsApi.create(workplaceId, body)
    const { tables: _t, ...rest } = hall
    set({ halls: [...get().halls, rest] })
    if (!get().activeHallId) set({ activeHallId: rest.id })
    return rest
  },

  updateHall: async (id, patch) => {
    const halls = get().halls
    const idx = halls.findIndex((h) => h.id === id)
    if (idx < 0) return
    const prev = halls[idx]
    set({ halls: halls.map((h, i) => (i === idx ? { ...prev, ...patch } : h)) })
    try {
      const updated = await hallsApi.update(id, patch)
      const { tables: _t, ...rest } = updated
      set({ halls: get().halls.map((h) => (h.id === id ? rest : h)) })
    } catch (e) {
      set({ halls: get().halls.map((h) => (h.id === id ? prev : h)) })
      throw e
    }
  },

  removeHall: async (id) => {
    await hallsApi.remove(id)
    set({
      halls: get().halls.filter((h) => h.id !== id),
      tables: get().tables.filter((t) => t.hall_id !== id),
    })
    if (get().activeHallId === id) {
      set({ activeHallId: get().sortedHalls()[0]?.id ?? null })
    }
    // Drop the persisted viewport so deleted halls don't accumulate as
    // dead entries in localStorage.
    clearHallViewport(id)
  },

  reorderHalls: async (workplaceId, ids) => {
    const prev = [...get().halls]
    const byId = new Map(prev.map((h) => [h.id, h]))
    const next = ids
      .map((id, position) => {
        const h = byId.get(id)
        return h ? { ...h, position } : null
      })
      .filter(Boolean)
    set({ halls: next })
    try {
      await hallsApi.reorder(workplaceId, ids)
    } catch (e) {
      set({ halls: prev })
      throw e
    }
  },

  // ----- Tables CRUD -----

  createTable: async (hallId, body) => {
    const table = await tablesApi.create(hallId, body)
    set({ tables: [...get().tables, table] })
    return table
  },

  /**
   * Update table fields. Optimistic with rollback.
   * For drag-and-drop, the editor debounces calls before invoking this.
   */
  updateTable: async (id, patch) => {
    const tables = get().tables
    const idx = tables.findIndex((t) => t.id === id)
    if (idx < 0) return
    const prev = tables[idx]
    set({
      tables: tables.map((t, i) => (i === idx ? { ...prev, ...patch } : t)),
    })
    try {
      const updated = await tablesApi.update(id, patch)
      set({ tables: get().tables.map((t) => (t.id === id ? updated : t)) })
    } catch (e) {
      set({ tables: get().tables.map((t) => (t.id === id ? prev : t)) })
      throw e
    }
  },

  /**
   * Local-only patch — used during drag for instant feedback;
   * the actual API call happens on dragend via updateTable().
   */
  patchTableLocal: (id, patch) => {
    set({
      tables: get().tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })
  },

  removeTable: async (id) => {
    await tablesApi.remove(id)
    set({ tables: get().tables.filter((t) => t.id !== id) })
  },

  // ----- Layouts (templates) -----

  /**
   * Load layouts for a given hall. Cached in `layouts` until the active
   * hall changes; subsequent calls are cheap re-fetches.
   */
  fetchLayouts: async (hallId) => {
    const result = await layoutsApi.listForHall(hallId)
    set({ layouts: result })
    return result
  },

  /**
   * Save the current arrangement as a new template. The mock/backend
   * snapshots positions from live tables; we just supply id + name.
   */
  createLayout: async (hallId, { id, name }) => {
    const layout = await layoutsApi.create(hallId, { id, name })
    set({ layouts: [...get().layouts, layout] })
    return layout
  },

  renameLayout: async (layoutId, name) => {
    const updated = await layoutsApi.update(layoutId, { name })
    set({
      layouts: get().layouts.map((l) => (l.id === layoutId ? updated : l)),
    })
    return updated
  },

  removeLayout: async (layoutId) => {
    await layoutsApi.remove(layoutId)
    set({ layouts: get().layouts.filter((l) => l.id !== layoutId) })
  },

  /**
   * Apply a layout. Returns a summary { moved, created, kept_extras,
   * deleted_extras } that the caller (HallEditorView) uses to:
   *   - pulse the affected tables
   *   - show a toast if any extras were kept due to active orders
   *
   * After apply we refetch `tables` for the hall so local state matches
   * the server's view (positions, new tables, removals).
   */
  applyLayout: async (layoutId, opts = {}) => {
    const summary = await layoutsApi.apply(layoutId, opts)
    // Re-pull tables for the active hall so positions / creates / deletes
    // all reflect in local state. We do this via the full hall tree to
    // reuse fetchAll's shape parsing.
    const active = get().halls.find((h) => h.id === get().activeHallId)
    if (active) {
      await get().fetchAll(active.workplace_id)
    }
    return summary
  },

  reset: () => {
    set({
      halls: [],
      tables: [],
      layouts: [],
      activeHallId: null,
      error: null,
    })
  },
}))