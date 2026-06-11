import { create } from 'zustand'
import { notesApi } from '@/api/notes'

/**
 * Notes store. Notes are private to the user, so we keep ALL of them
 * in memory (typical user has tens, not thousands).
 *
 * Filtering by scope/workplace/shift happens in getters, not via re-fetch.
 *
 * Reactivity reminder: byScope/byWorkplace/byShift are plain methods here.
 * In components (Notes view), select raw `items` and derive the filtered
 * lists with useMemo — don't call these as selectors directly, or you'll
 * get a fresh array each render. They're fine for one-off reads / counts.
 */
export const useNotesStore = create((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  // === getters (were: computed) ===

  /** Sorted: pinned first, then updated_at desc. */
  sorted: () =>
    [...get().items].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updated_at - a.updated_at
    }),

  /** Active (non-archived) notes, sorted. */
  active: () => get().sorted().filter((n) => !n.is_archived),

  archived: () => get().sorted().filter((n) => n.is_archived),

  /** Filter helpers — components decide what to call. */
  byScope: (scope) => get().active().filter((n) => n.scope === scope),
  byWorkplace: (workplaceId) =>
    get().active().filter((n) => n.workplace_id === workplaceId),
  byShift: (shiftId) => get().active().filter((n) => n.shift_id === shiftId),

  totalCount: () => get().active().length,
  pinnedCount: () => get().active().filter((n) => n.pinned).length,

  // === actions ===

  /**
   * Load all user notes. We pass include_archived=true so we have
   * everything; UI filters out archived by default, but lets users
   * toggle them on.
   */
  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await notesApi.list({ includeArchived: true, limit: 500 })
      set({ items })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  create: async (body) => {
    const note = await notesApi.create(body)
    set({ items: [...get().items, note] })
    return note
  },

  update: async (id, patch) => {
    const items = get().items
    const idx = items.findIndex((n) => n.id === id)
    if (idx < 0) return
    const prev = items[idx]
    set({ items: items.map((n, i) => (i === idx ? { ...prev, ...patch } : n)) })
    try {
      const updated = await notesApi.update(id, patch)
      set({ items: get().items.map((n) => (n.id === id ? updated : n)) })
    } catch (e) {
      set({ items: get().items.map((n) => (n.id === id ? prev : n)) })
      throw e
    }
  },

  togglePin: async (id) => {
    const note = get().items.find((n) => n.id === id)
    if (!note) return
    return get().update(id, { pinned: !note.pinned })
  },

  toggleArchive: async (id) => {
    const note = get().items.find((n) => n.id === id)
    if (!note) return
    return get().update(id, { is_archived: !note.is_archived })
  },

  remove: async (id) => {
    await notesApi.remove(id)
    set({ items: get().items.filter((n) => n.id !== id) })
  },

  reset: () => {
    set({ items: [], error: null })
  },
}))