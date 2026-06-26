import { create } from 'zustand'
import { ordersApi } from '@/api/orders'
import { newId } from '@/utils/nanoid'
import { useShiftStore } from './shift'
import { useHallStore } from './hall'

/**
 * Order store: orders of the current shift + cart draft.
 *
 * The cart (draft) is a single in-memory object built by OrderBuilder.
 * It survives navigation but is cleared when the shift closes / workplace
 * switches. Persistence: survives reload via a localStorage key, so
 * reopening the app continues the cart you were filling.
 *
 * ── Porting notes ───────────────────────────────────────────────────
 * 1. CROSS-STORE: in Vue this called useShiftStore()/useHallStore() inside
 *    actions. Here we use the static getState():
 *        useShiftStore.getState().current
 *        useHallStore.getState().tableById(id)
 *        useHallStore.getState().patchTableLocal(id, patch)
 *
 * 2. IMMUTABLE DRAFT: this is the most mutation-heavy store in the Vue app
 *    — it did `existing.quantity += n`, `Object.assign(item, patch)`,
 *    `draft.items.push(...)`. Zustand state must never be mutated in place,
 *    or components won't re-render. Every draft op below rebuilds the
 *    draft object: change items via .map()/.filter()/[...spread], then
 *    set({ draft: next }) and persist. The helper `setDraft(next)` does
 *    both (set state + persist) to keep this consistent.
 *
 * 3. getters that take a param (orderByTable, orderById,
 *    draftQuantityOfMenuItem) are plain methods. In components, select raw
 *    state (s => s.orders / s => s.draft) and derive with useMemo.
 * ─────────────────────────────────────────────────────────────────────
 */

const DRAFT_STORAGE_KEY = 'waiter-note:cart-draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistDraft(draft) {
  try {
    if (draft) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  } catch {
    /* quota exceeded — drop silently */
  }
}

export const useOrderStore = create((set, get) => ({
  // === Server state ===
  orders: [], // orders of the *current* shift, with items
  isLoading: false,
  error: null,

  // === Cart draft ===
  // Shape: { tableId, hallId, items: [{ id, menu_item_id, title, price,
  //          quantity, comment }], comments }
  draft: loadDraft(),

  // Internal helper: persist a draft AND update the store in one place.
  // Pass null to clear. Keeps the "always persist on change" invariant.
  _setDraft: (next) => {
    persistDraft(next)
    set({ draft: next })
  },

  // === getters: orders (were: computed) ===

  activeOrders: () => get().orders.filter((o) => !o.is_paid),
  paidOrders: () => get().orders.filter((o) => o.is_paid),

  /** Order currently attached to a specific table (active only). */
  orderByTable: (tableId) =>
    get().activeOrders().find((o) => o.table_id === tableId) || null,

  orderById: (id) => get().orders.find((o) => o.id === id) || null,

  /** Sum of total_price across active orders (live aggregate). */
  activeRevenue: () =>
    get().activeOrders().reduce((s, o) => s + (o.total_price || 0), 0),

  // === getters: draft ===

  draftIsEmpty: () => {
    const d = get().draft
    return !d || d.items.length === 0
  },

  draftItemCount: () => {
    const d = get().draft
    return d ? d.items.reduce((s, i) => s + i.quantity, 0) : 0
  },

  draftTotal: () => {
    const d = get().draft
    return d ? d.items.reduce((s, i) => s + i.price * i.quantity, 0) : 0
  },

  /**
   * Quantity of a specific menu item in the draft (for badges on menu
   * cards). Multiple draft entries with same menu_item_id are summed.
   */
  draftQuantityOfMenuItem: (menuItemId) => {
    const d = get().draft
    if (!d) return 0
    return d.items
      .filter((i) => i.menu_item_id === menuItemId)
      .reduce((s, i) => s + i.quantity, 0)
  },

  // === actions: server ===

  fetchForCurrentShift: async () => {
    const shift = useShiftStore.getState().current
    if (!shift?.id) {
      set({ orders: [] })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const orders = await ordersApi.listForShift(shift.id)
      set({ orders })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Submit the draft as a new order in the current shift.
   * On success: clears draft, prepends order, updates table/shift caches.
   */
  submitDraft: async ({ workplaceId }) => {
    const draft = get().draft
    if (!draft || draft.items.length === 0) {
      throw new Error('Корзина пуста')
    }
    const body = {
      id: newId(),
      table_id: draft.tableId,
      comments: draft.comments || null,
      guests_count: draft.guestCount || 1,
      items: draft.items.map((i) => ({
        id: newId(),
        menu_item_id: i.menu_item_id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        comment: i.comment || null,
        guest: i.guest || 1,
      })),
    }
    const order = await ordersApi.createInCurrentShift(workplaceId, body)
    set({ orders: [order, ...get().orders] })
    get().syncTableCache(order)
    get().clearDraft()
    return order
  },

  /**
   * Update Hall store cache: when an order is created/moved/paid, the
   * table's order_id and status need to match.
   *
   * Status policy (mirrors backend recompute):
   *   - No items / some items not served → "waiting" (yellow)
   *   - All items served                 → "occupied" (red, ready to pay)
   */
  syncTableCache: (order) => {
    if (!order.table_id) return
    const hall = useHallStore.getState()
    const t = hall.tableById(order.table_id)
    if (t) {
      const items = order.items || []
      const allServed = items.length > 0 && items.every((i) => i.served)
      hall.patchTableLocal(t.id, {
        order_id: order.id,
        status: allServed ? 'occupied' : 'waiting',
      })
    }
  },

  syncTableCacheCleared: (orderId, tableId) => {
    if (!tableId) return
    const hall = useHallStore.getState()
    const t = hall.tableById(tableId)
    if (t && t.order_id === orderId) {
      hall.patchTableLocal(t.id, { order_id: null, status: 'free' })
    }
  },

  addItemsToOrder: async (orderId, items) => {
    const newItems = items.map((i) => ({
      id: newId(),
      menu_item_id: i.menu_item_id,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
      comment: i.comment || null,
      guest: i.guest || 1,
    }))
    const updated = await ordersApi.addItems(orderId, newItems)
    get().replaceLocal(updated)
    get().syncTableCache(updated)
    return updated
  },

  updateOrderItem: async (itemId, patch) => {
    const updated = await ordersApi.updateItem(itemId, patch)
    get().replaceLocal(updated)
    return updated
  },

  /**
   * Toggle the "served" flag on a single line item. Optimistic so the
   * checkbox feels instant; on server failure we revert and rethrow.
   */
  toggleItemServed: async (orderId, itemId) => {
    const ord = get().orderById(orderId)
    if (!ord) return null
    const item = (ord.items || []).find((i) => i.id === itemId)
    if (!item) return null

    const prev = !!item.served
    const next = !prev

    // Optimistic local flip — rebuild order immutably so the table recolors
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, served: next } : i,
              ),
            }
          : o,
      ),
    })

    try {
      const updated = await ordersApi.updateItem(itemId, { served: next })
      get().replaceLocal(updated)
      return updated
    } catch (e) {
      // Revert on failure
      set({
        orders: get().orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: o.items.map((i) =>
                  i.id === itemId ? { ...i, served: prev } : i,
                ),
              }
            : o,
        ),
      })
      throw e
    }
  },

  removeOrderItem: async (itemId) => {
    const updated = await ordersApi.removeItem(itemId)
    get().replaceLocal(updated)
    return updated
  },

  moveOrder: async (orderId, newTableId) => {
    const order = get().orderById(orderId)
    const prevTableId = order?.table_id || null
    const updated = await ordersApi.move(orderId, newTableId)
    get().replaceLocal(updated)
    if (prevTableId && prevTableId !== newTableId) {
      get().syncTableCacheCleared(orderId, prevTableId)
    }
    get().syncTableCache(updated)
    return updated
  },

  payOrder: async (orderId, { tips = 0 } = {}) => {
    const updated = await ordersApi.pay(orderId, { tips })
    const tableId = updated.table_id
    get().replaceLocal(updated)
    get().syncTableCacheCleared(orderId, tableId)

    // Re-fetch current shift so dashboard aggregates update.
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  /**
   * Reopen a previously paid order. Returns to active state, table (if any)
   * re-attached, shift aggregates recomputed server-side.
   */
  reopenOrder: async (orderId) => {
    const updated = await ordersApi.reopen(orderId)
    get().replaceLocal(updated)
    // Quick local table sync.
    if (updated.table_id) {
      const hall = useHallStore.getState()
      const t = hall.tableById(updated.table_id)
      if (t) {
        hall.patchTableLocal(t.id, {
          order_id: updated.id,
          status: (updated.items?.length || 0) > 0 ? 'occupied' : 'waiting',
        })
      }
    }
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  /**
   * Edit a paid order's items / tips / comments. Server validates the
   * shift is open and the user is the shift owner.
   */
  editPaidOrder: async (orderId, patch) => {
    const updated = await ordersApi.editPaid(orderId, patch)
    get().replaceLocal(updated)
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  deleteOrder: async (orderId) => {
    const order = get().orderById(orderId)
    const tableId = order?.table_id || null
    const wasPaid = order?.is_paid || false
    await ordersApi.remove(orderId)
    set({ orders: get().orders.filter((o) => o.id !== orderId) })
    get().syncTableCacheCleared(orderId, tableId)

    if (wasPaid) {
      const shift = useShiftStore.getState()
      if (order && shift.current?.id === order.shift_id) {
        shift
          .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
          .catch(() => {})
      }
    }
  },

  /**
   * Drop a fresh server snapshot of an order into local state. Also syncs
   * the bound table's status — without this, served-toggling and item
   * removal don't recolor the table on the map.
   */
  replaceLocal: (order) => {
    const orders = get().orders
    const idx = orders.findIndex((o) => o.id === order.id)
    if (idx >= 0) {
      set({ orders: orders.map((o) => (o.id === order.id ? order : o)) })
    } else {
      set({ orders: [order, ...orders] })
    }
    // Sync table cache too, unless the order is now paid — paid orders
    // detach from the table, handled by syncTableCacheCleared at the call
    // site (payOrder / deleteOrder).
    if (!order.is_paid && order.table_id) {
      get().syncTableCache(order)
    }
  },

  // === actions: draft (all immutable — rebuild + _setDraft) ===

  /** Initialize a fresh draft. Optionally pre-select a table. */
  startDraft: ({ tableId = null, hallId = null } = {}) => {
    get()._setDraft({ tableId, hallId, items: [], comments: '', guestCount: 1 })
  },

  /**
   * Replace the draft with a snapshot of a paid order, for the "edit paid
   * order" flow. Held in memory only — NOT persisted (one-shot edit).
   */
  replaceDraftWithPaidOrder: (order) => {
    // Note: ephemeral — set state but DON'T persist.
    set({
      draft: {
        tableId: order.table_id || null,
        hallId: order.hall_id || null,
        items: (order.items || []).map((i) => ({
          id: i.id,
          menu_item_id: i.menu_item_id,
          title: i.title,
          price: Number(i.price),
          quantity: Number(i.quantity),
          comment: i.comment || null,
          guest: i.guest || 1,
        })),
        comments: order.comments || '',
        guestCount: order.guests_count || 1,
      },
    })
  },

  /**
   * Start an empty ephemeral draft pinned to a table. Used by the
   * "add items to active order" flow. Ephemeral — not persisted.
   */
  replaceDraftEphemeral: ({ tableId = null, hallId = null, guestsCount = 1 } = {}) => {
    set({ draft: { tableId, hallId, items: [], comments: '', guestCount: guestsCount || 1 } })
  },

  /**
   * Add a menu item to the draft. If it already exists with the SAME
   * comment, increment quantity; otherwise add a new line.
   */
  addToDraft: (menuItem, { comment = null, quantity = 1, guest = 1 } = {}) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    // Same item + same comment + same guest → bump quantity; else new line.
    const existing = d.items.find(
      (i) =>
        i.menu_item_id === menuItem.id &&
        (i.comment || null) === (comment || null) &&
        (i.guest || 1) === guest,
    )
    let items
    if (existing) {
      items = d.items.map((i) =>
        i === existing ? { ...i, quantity: i.quantity + quantity } : i,
      )
    } else {
      items = [
        ...d.items,
        {
          id: newId(),
          menu_item_id: menuItem.id,
          title: menuItem.title,
          price: menuItem.price,
          quantity,
          comment,
          guest,
        },
      ]
    }
    get()._setDraft({ ...d, items })
  },

  updateDraftItem: (itemId, patch) => {
    const d = get().draft
    if (!d) return
    const target = d.items.find((i) => i.id === itemId)
    if (!target) return
    const merged = { ...target, ...patch }
    if (merged.quantity <= 0) {
      get().removeDraftItem(itemId)
    } else {
      get()._setDraft({
        ...d,
        items: d.items.map((i) => (i.id === itemId ? merged : i)),
      })
    }
  },

  incDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    get()._setDraft({
      ...d,
      items: d.items.map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    })
  },

  decDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    const item = d.items.find((i) => i.id === itemId)
    if (!item) return
    if (item.quantity <= 1) {
      get().removeDraftItem(itemId)
    } else {
      get()._setDraft({
        ...d,
        items: d.items.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i,
        ),
      })
    }
  },

  removeDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    get()._setDraft({ ...d, items: d.items.filter((i) => i.id !== itemId) })
  },

  /**
   * Empty the cart's items but KEEP the rest of the draft — table, hall,
   * guest count and comments stay. Used by "Очистить корзину": only the
   * dish positions are removed, the chosen number of guests remains.
   */
  clearDraftItems: () => {
    const d = get().draft
    if (!d) return
    get()._setDraft({ ...d, items: [] })
  },

  setDraftTable: (tableId, hallId) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    get()._setDraft({ ...d, tableId, hallId })
  },

  setDraftComments: (comments) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    get()._setDraft({ ...d, comments })
  },

  // === actions: guests (split a draft across 1..10 guests; 1 = single bill) ===

  /** Set guest count (clamped 1..10). Used by the initial "how many guests" pick. */
  setGuestCount: (n) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    const count = Math.max(1, Math.min(10, n | 0))
    get()._setDraft({ ...d, guestCount: count })
  },

  /** Add one guest (up to 10). */
  addGuest: () => {
    const d = get().draft
    if (!d) return
    if ((d.guestCount || 1) >= 10) return
    get()._setDraft({ ...d, guestCount: (d.guestCount || 1) + 1 })
  },

  /**
   * Remove guest `g`: drop that guest's items and renumber the rest so the
   * sequence stays 1..N (guest 3 becomes 2, etc.). Min count is 1.
   */
  removeGuest: (g) => {
    const d = get().draft
    if (!d) return
    const count = d.guestCount || 1
    if (count <= 1) return
    const items = d.items
      .filter((i) => (i.guest || 1) !== g)
      .map((i) => ((i.guest || 1) > g ? { ...i, guest: i.guest - 1 } : i))
    get()._setDraft({ ...d, items, guestCount: count - 1 })
  },

  clearDraft: () => {
    get()._setDraft(null)
  },

  /**
   * Drop draft items whose menu_item_id is not in the supplied set of
   * currently-known menu item IDs. Used after the menu loads to reconcile
   * a persisted draft against the live catalogue.
   * Returns the number of items removed so the caller can toast.
   */
  reconcileDraftWithMenu: (validMenuItemIds) => {
    const d = get().draft
    if (!d || !d.items?.length) return 0
    const valid = new Set(validMenuItemIds)
    const before = d.items.length
    const kept = d.items.filter((i) => valid.has(i.menu_item_id))
    const removed = before - kept.length
    if (removed === 0) return 0

    if (kept.length === 0) {
      get().clearDraft()
    } else {
      get()._setDraft({ ...d, items: kept })
    }
    return removed
  },

  reset: () => {
    set({ orders: [], error: null })
    get().clearDraft()
  },
}))
