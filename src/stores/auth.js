import { create } from 'zustand'
import { meApi } from '@/api/me'

/**
 * Auth store: current user + locale.
 * The user is created server-side on first /me request — no separate /login.
 *
 * ── Pinia → Zustand mapping (read this once, applies to every store) ──
 *
 *  Pinia (setup store)                 Zustand
 *  ──────────────────────              ───────────────────────────────
 *  const x = ref(0)                    state field:  x: 0
 *  x.value = 1                         set({ x: 1 })
 *  read x.value                        get().x   (in actions)
 *  computed(() => ...)                 NOT stored — derived in selector
 *                                       or a plain getter fn (see below)
 *  function act() {...}                act: () => { ... }  (a field)
 *  store.x   (auto-unwrapped)          useAuthStore(s => s.x)  (component)
 *
 * KEY DIFFERENCE — computed/getters:
 *   Vue's `computed` recomputes reactively. Zustand has no computed; the
 *   idiomatic React approach is to derive in the component via a selector,
 *   e.g.  const isAuth = useAuthStore(s => s.user !== null)
 *   For getters that other STORE CODE needs, we expose small functions
 *   that read get(). They're plain functions, recomputed on call — fine
 *   because they're cheap.
 *
 * KEY DIFFERENCE — reading state inside actions:
 *   Vue: read x.value directly. Zustand: call get() to read current state,
 *   set(partial) to update. set merges shallowly (like React setState).
 * ─────────────────────────────────────────────────────────────────────
 */
export const useAuthStore = create((set, get) => ({
  // === state (was: ref(...)) ===
  user: null,
  isLoading: false,
  error: null,

  // === Bot access gate ===
  // Tri-state probe result from GET /me/bot-access.
  //   null         — not checked yet (initial state)
  //   'ok'         — bot can message the user, app is unlocked
  //   'blocked'    — user hasn't /started the bot (or blocked it); show gate
  //   'unreachable'— Telegram API hiccup; show retry, NOT the gate
  botStatus: null,
  botUsername: null,

  // === getters ===
  // In Vue these were `computed`. Here they're functions that read get().
  // Components that want reactive derivations should prefer inline
  // selectors (see mapping note above); these exist for use inside other
  // store actions / boot logic where calling a function is natural.
  isAuthenticated: () => get().user !== null,
  language: () => get().user?.language ?? 'ru',
  timezone: () => get().user?.timezone ?? 'Europe/Moscow',
  lastWorkplaceId: () => get().user?.last_workplace_id ?? null,
  isOnboardingCompleted: () => get().user?.is_onboarding_completed ?? false,
  botAccessGranted: () => get().botStatus === 'ok',

  // === actions ===

  /** Load current user. Call once on app startup. */
  init: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await meApi.get()
      set({ user })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  /** Update profile fields. Optimistic with rollback. */
  updateProfile: async (patch) => {
    const prev = get().user
    if (!prev) return
    // optimistic
    set({ user: { ...prev, ...patch } })
    try {
      const user = await meApi.update(patch)
      set({ user })
    } catch (e) {
      set({ user: prev }) // rollback
      throw e
    }
  },

  /**
   * Local-only update of last_workplace_id.
   * Called by workplaceStore.setCurrent() to keep auth state in sync —
   * it doesn't hit /me, since /workplaces/{id}/select handles the server side.
   */
  setLastWorkplaceLocal: (workplaceId) => {
    const user = get().user
    if (user) set({ user: { ...user, last_workplace_id: workplaceId } })
  },

  /**
   * Mark the onboarding flow as completed. Persists via PATCH /me so the
   * intro screens are never shown again on subsequent app launches.
   */
  completeOnboarding: async () => {
    await get().updateProfile({ is_onboarding_completed: true })
  },

  /**
   * Check whether the configured bot can write to this user. Called once
   * on boot, then again after the user taps "I pressed /start, recheck"
   * on the gate screen.
   *
   * Stores the result in botStatus; callers read that to route. We swallow
   * exceptions here on purpose — a thrown network error would just look
   * like "unreachable" to the caller anyway, and we want a clean tri-state
   * value instead of try/catch all over the place.
   */
  checkBotAccess: async () => {
    try {
      const res = await meApi.getBotAccess()
      set({
        botStatus: res?.status ?? 'unreachable',
        botUsername: res?.bot_username ?? null,
      })
    } catch {
      set({ botStatus: 'unreachable' })
    }
    return get().botStatus
  },

  reset: () => {
    set({ user: null, error: null, botStatus: null, botUsername: null })
  },
}))