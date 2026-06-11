import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useMatches } from 'react-router-dom'

import { useAuthStore } from '@/stores/auth'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import { useShiftStore } from '@/stores/shift'
import { useHallStore } from '@/stores/hall'
import { useNotesStore } from '@/stores/notes'
import { useOrderStore } from '@/stores/order'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'

import {
  rememberRoute,
  readRememberedRoute,
  isPageReload,
  deepLinkImportCode,
} from '@/utils/navMemory'

import ToastContainer from '@/components/ToastContainer'
import ConfirmDialog from '@/components/ConfirmDialog'
import PromptHost from '@/components/PromptHost'
import DiagnosticsPanel from '@/components/DiagnosticsPanel'
import BottomNavigation from '@/components/BottomNavigation'
import PrimaryAction from '@/components/PrimaryAction'

/* ── App.vue → App.jsx mapping (the conceptual heart of the migration) ──
 *
 *  Vue                                  React
 *  ───────────────────────────          ──────────────────────────────────
 *  ref(false) ready/bootError            useState
 *  computed hideBottomNav                derived from useMatches()
 *  onMounted(boot)                       useEffect(boot, []) + StrictMode guard
 *  watch(() => workplace.currentId, …)   useEffect(…, [currentId])
 *  watch(() => auth.botStatus, …)        useEffect(…, [botStatus])
 *  watch(() => shift.current?.id, …)     useEffect(…, [currentShiftId])
 *  settings.init() in setup body         useEffect(() => settings.init(), [])
 *  router.replace({ name })              navigate(path, { replace: true })
 *
 *  Reactivity rule: for an effect to fire on a store value changing, the
 *  component must SUBSCRIBE to that value via a selector — otherwise App
 *  never re-renders and the effect never re-runs. So we read currentId,
 *  botStatus, currentShiftId via useXStore(s => …) below. Actions we only
 *  CALL (not watch) we pull off getState() to avoid needless re-renders.
 * ────────────────────────────────────────────────────────────────────── */

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMatches()
  const hideBottomNav = matches.some((m) => m.handle?.hideBottomNav === true)

  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState(null)

  // Subscribe to the values our effects watch (see reactivity rule above).
  const currentId = useWorkplaceStore((s) => s.currentId)
  const botStatus = useAuthStore((s) => s.botStatus)
  const currentShiftId = useShiftStore((s) => s.current?.id ?? null)
  const diagnosticsOpen = useUiStore((s) => s.diagnosticsOpen)

  // refs to coordinate boot vs the watcher effects (see notes inline).
  const hasBootedRef = useRef(false)
  const bootLoadedWorkplaceRef = useRef(null) // currentId boot() already loaded
  const prevBotStatusRef = useRef(botStatus)

  // ── settings.init(): paint cached appearance ASAP (was: in setup body) ──
  // Runs once, before/independent of network I/O, so no light-flash on a
  // dark device. Server prefs applied later inside boot() via applyFromUser.
  useEffect(() => {
    useSettingsStore.getState().init()
  }, [])

  // ── boot(): the big startup sequence (was: onMounted(boot)) ──
  // useCallback-free: we define boot inside the component but guard against
  // React 19 StrictMode's double-mount in dev with hasBootedRef.
  async function boot() {
    setBootError(null)
    setReady(false)

    const auth = useAuthStore.getState()
    const workplace = useWorkplaceStore.getState()
    const menu = useMenuStore.getState()
    const shift = useShiftStore.getState()
    const hall = useHallStore.getState()
    const notes = useNotesStore.getState()
    const order = useOrderStore.getState()
    const settings = useSettingsStore.getState()
    const ui = useUiStore.getState()

    try {
      await auth.init()

      // Reconcile appearance with what the server knows about this user.
      settings.applyFromUser(useAuthStore.getState().user)

      // Bot-access gate. Block ONLY on explicit 'blocked'. On 'unreachable'
      // we fail OPEN — locking everyone out over a backend network hiccup
      // is worse than silently skipping a notification later.
      const status = await auth.checkBotAccess()
      if (status === 'blocked') {
        if (location.pathname !== '/bot-required') {
          navigate('/bot-required', { replace: true })
        }
        setReady(true)
        return
      }
      // 'ok' or 'unreachable' — continue booting.

      await workplace.fetchAll()
      notes.fetchAll().catch(() => {})

      const wpId = useWorkplaceStore.getState().currentId
      if (wpId) {
        // Mark this workplace as boot-loaded so the [currentId] effect
        // doesn't redundantly reload it right after boot.
        bootLoadedWorkplaceRef.current = wpId
        await Promise.all([
          menu.fetchAll(wpId),
          shift.fetchCurrent(wpId),
          hall.fetchAll(wpId),
        ])
        // Reconcile the persisted draft against the freshly loaded menu.
        const removed = order.reconcileDraftWithMenu(
          useMenuStore.getState().items.map((i) => i.id),
        )
        if (removed > 0) {
          ui.toastWarning(
            removed === 1
              ? 'Одной позиции больше нет в меню — убрали из заказа'
              : `${removed} позиций больше нет в меню — убрали из заказа`,
          )
        }
        // Orders depend on shift — fetch after shift loaded.
        if (useShiftStore.getState().current?.id) {
          order.fetchForCurrentShift().catch(() => {})
        }
        // History for the shifts screen.
        shift.fetchHistory(wpId, { reset: true }).catch(() => {})
      }

      // ===== Routing decision at app start =====
      // Priority:
      //   1. Onboarding incomplete → onboarding (everything else waits).
      //   2. Deep-linked import (start_param) → /import?code=…
      //   3. Page reload + remembered path → restore it.
      //   4. Fresh launch / no memory → /home.
      if (!useAuthStore.getState().isOnboardingCompleted()) {
        if (location.pathname !== '/onboarding') {
          navigate('/onboarding', { replace: true })
        }
      } else {
        const importCode = deepLinkImportCode()
        if (importCode) {
          navigate(`/import?code=${encodeURIComponent(importCode)}`, {
            replace: true,
          })
        } else {
          const remembered = isPageReload() ? readRememberedRoute() : null
          if (remembered) {
            navigate(`${remembered.pathname}${remembered.search}`, {
              replace: true,
            })
          } else if (location.pathname !== '/home') {
            navigate('/home', { replace: true })
          }
        }
      }

      setReady(true)
    } catch (e) {
      setBootError(e.message || 'Не удалось загрузить данные')
    }
  }

  useEffect(() => {
    // StrictMode double-mount guard: boot exactly once.
    if (hasBootedRef.current) return
    hasBootedRef.current = true
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Navigation memory: remember every route change once booted ──
  // (was: watch(() => route.fullPath)). Skip until ready so boot()'s own
  // routing doesn't get double-recorded.
  useEffect(() => {
    if (ready) rememberRoute(location)
  }, [ready, location])

  // ── watcher: bot gate clears → re-run boot ──
  // (was: watch(() => auth.botStatus)). When status flips to 'ok' from a
  // non-ok value, the early-returned boot() never loaded data — re-run it.
  useEffect(() => {
    const prev = prevBotStatusRef.current
    prevBotStatusRef.current = botStatus
    if (botStatus === 'ok' && prev && prev !== 'ok') {
      boot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botStatus])

  // ── watcher: workplace switch → reload downstream stores ──
  // (was: watch(() => workplace.currentId)). Skip the value boot() already
  // loaded to avoid a duplicate fetch right after startup.
  useEffect(() => {
    if (bootLoadedWorkplaceRef.current === currentId) {
      // Consume the flag: a later switch BACK to this id should reload.
      bootLoadedWorkplaceRef.current = null
      return
    }
    const menu = useMenuStore.getState()
    const shift = useShiftStore.getState()
    const hall = useHallStore.getState()
    const order = useOrderStore.getState()

    if (!currentId) {
      menu.reset()
      shift.reset()
      hall.reset()
      order.reset()
      return
    }
    menu.fetchAll(currentId).catch(() => {})
    hall.fetchAll(currentId).catch(() => {})
    shift
      .fetchCurrent(currentId)
      .then(() => order.fetchForCurrentShift().catch(() => {}))
      .catch(() => {})
    shift.fetchHistory(currentId, { reset: true }).catch(() => {})
  }, [currentId])

  // ── watcher: shift open/close → reload orders ──
  // (was: watch(() => shift.current?.id)).
  useEffect(() => {
    const order = useOrderStore.getState()
    if (currentShiftId) {
      order.fetchForCurrentShift().catch(() => {})
    } else {
      useOrderStore.setState({ orders: [] })
    }
  }, [currentShiftId])

  // ── Render ──
  // The three states (loading / error / ready) all share the same shell so
  // that global overlays — toasts, confirm dialog — stay mounted regardless
  // (matches the Vue version, where they sat OUTSIDE the v-if/v-else block).
  let body
  if (!ready && !bootError) {
    body = (
      <div className="boot">
        <div className="spinner" />
        <p className="boot-text">Загрузка…</p>
      </div>
    )
  } else if (bootError) {
    body = (
      <div className="boot">
        <p className="boot-error">⚠️ {bootError}</p>
        <button className="boot-retry" onClick={boot}>
          Попробовать снова
        </button>
        <button
          className="boot-logs"
          onClick={() => useUiStore.getState().openDiagnostics()}
        >
          Показать логи
        </button>
      </div>
    )
  } else {
    body = (
      <>
        <main
          className={
            hideBottomNav ? 'app-content app-content--full' : 'app-content'
          }
        >
          <Outlet />
        </main>
        {!hideBottomNav && <BottomNavigation />}
        {!hideBottomNav && <PrimaryAction />}
      </>
    )
  }

  return (
    <div className="app-shell">
      {body}

      {/* Global overlays — always mounted, all states */}
      <ToastContainer />
      <ConfirmDialog />
      <PromptHost />
      {diagnosticsOpen && (
        <DiagnosticsPanel
          onClose={() => useUiStore.getState().closeDiagnostics()}
        />
      )}
    </div>
  )
}