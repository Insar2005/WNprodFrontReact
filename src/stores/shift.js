import { create } from 'zustand'
import { shiftsApi } from '@/api/shifts'

/**
 * Shift store: currently-open shift + history.
 *
 * `current` is the open shift in the user's *currently selected* workplace.
 * In Vue it was reloaded by App.vue's watcher on workplace.currentId; in
 * React that becomes a useEffect in App.jsx (step 3).
 *
 * ── Porting note: constants vs state ────────────────────────────────
 * HISTORY_PAGE_SIZE is a module constant (not reactive — never changes),
 * so it lives outside the store. historyOffset IS state (it advances as
 * pages load), so it stays in the store — but no component needs to read
 * it directly; it's bookkeeping for fetchHistory's pagination.
 * ─────────────────────────────────────────────────────────────────────
 */

const HISTORY_PAGE_SIZE = 30

export const useShiftStore = create((set, get) => ({
  current: null, // open shift or null
  history: [],
  isLoading: false,
  isLoadingHistory: false,
  error: null,

  // Pagination state for history
  historyOffset: 0,
  historyHasMore: true,

  // === getters (were: computed) ===

  isOpen: () => !!get().current && !get().current.is_closed,
  canTakeOrders: () => get().isOpen(),

  /** Estimated earnings for fixed shift type (= base pay). */
  baseEarnings: () => get().current?.pay_for_shift ?? 0,
  /** Tips collected so far. */
  tipsSoFar: () => get().current?.total_tips ?? 0,
  /** Total cash through the till (paid orders sum). */
  cashRegister: () => get().current?.total_cash_register ?? 0,
  /** Computed wage for current shift. */
  wageSoFar: () => get().current?.total_pay_for_shift ?? 0,
  /** Order count (paid only — matches backend recompute). */
  paidOrderCount: () => get().current?.order_count ?? 0,

  // === actions ===

  /** Load currently-open shift in the workplace. */
  fetchCurrent: async (workplaceId) => {
    if (!workplaceId) {
      set({ current: null })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const current = await shiftsApi.getCurrent(workplaceId)
      set({ current })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Load (or reload) shift history with pagination.
   * Pass reset=true to start over (after closing a shift, switching
   * workplace, etc).
   */
  fetchHistory: async (workplaceId, { reset = false } = {}) => {
    if (!workplaceId) {
      set({ history: [], historyOffset: 0, historyHasMore: false })
      return
    }
    if (reset) {
      set({ historyOffset: 0, historyHasMore: true, history: [] })
    }
    if (!get().historyHasMore || get().isLoadingHistory) return

    set({ isLoadingHistory: true })
    try {
      const page = await shiftsApi.list(workplaceId, {
        limit: HISTORY_PAGE_SIZE,
        offset: get().historyOffset,
        onlyMine: true,
        closedOnly: true,
      })
      set({
        history: [...get().history, ...page],
        historyOffset: get().historyOffset + page.length,
        historyHasMore: page.length === HISTORY_PAGE_SIZE,
      })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoadingHistory: false })
    }
  },

  /** Open a new shift in the workplace. */
  open: async (workplaceId, body) => {
    const shift = await shiftsApi.open(workplaceId, body)
    set({ current: shift })
    return shift
  },

  /**
   * Close current (or specified) shift. After successful close:
   *  - current becomes null
   *  - the closed shift is prepended to history
   */
  close: async (shiftId, { force = false } = {}) => {
    const closed = await shiftsApi.close(shiftId, { force })
    if (get().current?.id === shiftId) set({ current: null })
    set({
      history: [closed, ...get().history.filter((s) => s.id !== shiftId)],
    })
    return closed
  },

  /** Force aggregate recompute. Useful if numbers look wrong. */
  recompute: async (shiftId) => {
    const updated = await shiftsApi.recompute(shiftId)
    if (get().current?.id === shiftId) {
      set({ current: updated })
    } else {
      set({
        history: get().history.map((s) => (s.id === shiftId ? updated : s)),
      })
    }
    return updated
  },

  remove: async (shiftId) => {
    await shiftsApi.remove(shiftId)
    set({ history: get().history.filter((s) => s.id !== shiftId) })
    if (get().current?.id === shiftId) set({ current: null })
  },

  /**
   * Locally update aggregate fields on current shift after orders change.
   * Called by orderStore after pay/delete to keep dashboard live without
   * re-fetch. For correctness, prefer recompute() on critical operations.
   */
  patchCurrentAggregates: (patch) => {
    const cur = get().current
    if (!cur) return
    set({ current: { ...cur, ...patch } })
  },

  reset: () => {
    set({
      current: null,
      history: [],
      historyOffset: 0,
      historyHasMore: true,
      error: null,
    })
  },
}))