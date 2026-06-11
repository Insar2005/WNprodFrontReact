import { create } from 'zustand'
import { workplacesApi } from '@/api/workplaces'
import { useAuthStore } from './auth'

/**
 * Workplace store: list + current selected workplace.
 *
 * `currentId` change is the trigger for downstream stores to reload.
 * In the Vue app, App.vue watched this and called hallStore.fetchAll()
 * etc. In React the equivalent lives in App.jsx as a useEffect keyed on
 * currentId (ported in step 3).
 *
 * ── Porting note: cross-store access ────────────────────────────────
 * Pinia let one store call another by invoking its composable inside an
 * action: `const auth = useAuthStore()`. In Zustand the store IS a hook;
 * calling a hook outside React render is illegal. Instead, read/poke
 * another store imperatively via its static getState():
 *      useAuthStore.getState().lastWorkplaceId()
 *      useAuthStore.getState().setLastWorkplaceLocal(id)
 * Note lastWorkplaceId is a getter FUNCTION here (it was a computed in
 * Vue), so we call it.
 *
 * ── Porting note: immutable arrays ──────────────────────────────────
 * Vue mutated items.value in place (push, items[idx] = ...). Zustand
 * state is immutable: build a new array/object and set() it. Each action
 * below shows the pattern.
 * ─────────────────────────────────────────────────────────────────────
 */
export const useWorkplaceStore = create((set, get) => ({
  items: [],
  currentId: null,
  isLoading: false,
  error: null,

  // === getters (were: computed) ===

  current: () => get().items.find((w) => w.id === get().currentId) ?? null,

  activeList: () =>
    [...get().items]
      .filter((w) => !w.is_archived)
      .sort((a, b) => a.position - b.position),

  archivedList: () => get().items.filter((w) => w.is_archived),

  isEmpty: () => get().items.length === 0,

  // Convenience proxies — components don't have to drill into `current`
  currency: () => get().current()?.currency ?? 'RUB',
  timezone: () => get().current()?.timezone ?? 'Europe/Moscow',
  serviceDefault: () => get().current()?.service_percent_default ?? 0,
  shiftTypeDefault: () => get().current()?.shift_type_default ?? 'fixed',
  payDefault: () => get().current()?.pay_for_shift_default ?? 0,
  isCurrentOwner: () => get().current()?.my_role === 'owner',

  // === actions ===

  /** Load all workplaces and pick the "current" one. */
  fetchAll: async ({ includeArchived = false } = {}) => {
    set({ isLoading: true, error: null })
    try {
      const data = await workplacesApi.list({ includeArchived })
      // The API returns a bare array. Defend against an unexpected shape
      // (e.g. a paginated {items:[...]} wrapper) so items always stays an
      // array — otherwise later .filter() calls throw.
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : []
      set({ items })

      // Pick current: prefer last_workplace_id from auth, else first active.
      const lastId = useAuthStore.getState().lastWorkplaceId()
      const candidate =
        (lastId && items.find((w) => w.id === lastId && !w.is_archived)) ||
        get().activeList()[0] ||
        null
      set({ currentId: candidate ? candidate.id : null })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  /** Switch current workplace. Triggers downstream reload via App.jsx effect. */
  setCurrent: async (id) => {
    if (id === get().currentId) return
    const wp = get().items.find((w) => w.id === id)
    if (!wp) throw new Error('workplace not in store')

    const prev = get().currentId
    set({ currentId: id })
    try {
      await workplacesApi.select(id)
      useAuthStore.getState().setLastWorkplaceLocal(id)
    } catch (e) {
      set({ currentId: prev })
      throw e
    }
  },

  /** Create new workplace. On success, becomes current. */
  create: async (body) => {
    const wp = await workplacesApi.create(body)
    const items = Array.isArray(get().items) ? get().items : []
    set({ items: [...items, wp], currentId: wp.id })
    useAuthStore.getState().setLastWorkplaceLocal(wp.id)
    return wp
  },

  /** Update fields. Optimistic with rollback. */
  update: async (id, patch) => {
    const items = get().items
    const idx = items.findIndex((w) => w.id === id)
    if (idx < 0) return
    const prev = items[idx]
    // optimistic
    set({
      items: items.map((w, i) => (i === idx ? { ...prev, ...patch } : w)),
    })
    try {
      const updated = await workplacesApi.update(id, patch)
      set({
        items: get().items.map((w) => (w.id === id ? updated : w)),
      })
    } catch (e) {
      set({ items: get().items.map((w) => (w.id === id ? prev : w)) })
      throw e
    }
  },

  archive: async (id) => {
    const updated = await workplacesApi.archive(id)
    set({ items: get().items.map((w) => (w.id === id ? updated : w)) })
    // If we archived the current one, move to the first active
    if (get().currentId === id) {
      const next = get().activeList()[0] || null
      set({ currentId: next ? next.id : null })
    }
    return updated
  },

  unarchive: async (id) => {
    const updated = await workplacesApi.unarchive(id)
    set({ items: get().items.map((w) => (w.id === id ? updated : w)) })
    return updated
  },

  remove: async (id) => {
    await workplacesApi.remove(id)
    set({ items: get().items.filter((w) => w.id !== id) })
    if (get().currentId === id) {
      const next = get().activeList()[0] || null
      set({ currentId: next ? next.id : null })
    }
  },

  reorder: async (ids) => {
    // Optimistic: apply order locally, then sync.
    const prev = [...get().items]
    const byId = new Map(prev.map((w) => [w.id, w]))
    let next = ids
      .map((id, position) => {
        const w = byId.get(id)
        return w ? { ...w, position } : null
      })
      .filter(Boolean)
    // append unaffected ones (e.g. archived not in `ids`)
    for (const w of prev) {
      if (!next.find((x) => x.id === w.id)) next = [...next, w]
    }
    set({ items: next })
    try {
      await workplacesApi.reorder(ids)
    } catch (e) {
      set({ items: prev })
      throw e
    }
  },

  reset: () => {
    set({ items: [], currentId: null, error: null })
  },
}))