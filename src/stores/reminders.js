import { create } from 'zustand'
import { remindersApi } from '@/api/reminders'

/**
 * "Remind me before" presets (minutes before remind_at). Single choice
 * per reminder. The bot fires the notification at remind_at - lead.
 */
export const LEAD_OPTIONS = [
  { value: 0, label: 'В момент' },
  { value: 5, label: 'За 5 минут' },
  { value: 15, label: 'За 15 минут' },
  { value: 30, label: 'За 30 минут' },
  { value: 60, label: 'За 1 час' },
  { value: 120, label: 'За 2 часа' },
  { value: 1440, label: 'За 1 день' },
]

export function leadLabel(value) {
  return LEAD_OPTIONS.find((o) => o.value === value)?.label ?? `За ${value} мин`
}

/**
 * Reminders store. Personal to the user; kept fully in memory (a user has
 * tens, not thousands). Mirrors the notes store conventions: optimistic
 * update() with rollback, selectors derived in components via useMemo.
 */
export const useRemindersStore = create((set, get) => ({
  items: [],
  isLoading: false,
  loaded: false,
  error: null,

  sorted: () => [...get().items].sort((a, b) => a.remind_at - b.remind_at),

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await remindersApi.list({ includeDone: true, limit: 500 })
      set({ items, loaded: true })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  create: async (body) => {
    const r = await remindersApi.create(body)
    set({ items: [...get().items, r] })
    return r
  },

  update: async (id, patch) => {
    const items = get().items
    const idx = items.findIndex((r) => r.id === id)
    if (idx < 0) return
    const prev = items[idx]
    set({ items: items.map((r, i) => (i === idx ? { ...prev, ...patch } : r)) })
    try {
      const updated = await remindersApi.update(id, patch)
      set({ items: get().items.map((r) => (r.id === id ? updated : r)) })
    } catch (e) {
      set({ items: get().items.map((r) => (r.id === id ? prev : r)) })
      throw e
    }
  },

  toggleDone: async (id) => {
    const r = get().items.find((x) => x.id === id)
    if (!r) return
    return get().update(id, { is_done: !r.is_done })
  },

  remove: async (id) => {
    const prev = get().items
    set({ items: prev.filter((r) => r.id !== id) })
    try {
      await remindersApi.remove(id)
    } catch (e) {
      set({ items: prev })
      throw e
    }
  },

  reset: () => set({ items: [], loaded: false, error: null }),
}))
