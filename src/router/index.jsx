import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '@/App'

// ── Vue Router → React Router mapping ───────────────────────────────
// Vue Router                          React Router 7
//   createWebHashHistory()              createHashRouter([...])
//   { path, name, component }           { path, element }   (no `name`)
//   component: () => import(...)         lazy: () => import(...)
//   <router-view/>                       <Outlet/> (rendered inside App)
//   meta: { hideBottomNav: true }        handle: { hideBottomNav: true }
//   children: [...]                      children: [...]
//   scrollBehavior(){...}                <ScrollReset/> component (step 3)
//
// Note on `meta` → `handle`: React Router exposes per-route static data
// via `route.handle`, read with the useMatches() hook. We use it to carry
// the same `hideBottomNav` flag your Vue routes had in `meta`.
//
// Note on `name`: React Router has no route names. Navigation is by path.
// Anywhere the Vue code used route.name (e.g. navigation memory), the
// React code will use location.pathname instead. We'll handle that when
// porting App.jsx.
//
// Note on hash history: kept from the Vue project. For a Telegram Mini App
// it avoids server-rewrite config and survives reloads on deep paths.
// ────────────────────────────────────────────────────────────────────

// Browser history (clean URLs). Firebase Hosting rewrites all paths to
// index.html (see firebase.json), so deep links and reloads work. We avoid
// hash history because Telegram Mini Apps append #tgWebAppData=... to the
// URL, which a hash router would mis-parse as a route → 404.
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: 'home',
        lazy: async () => ({
          Component: (await import('@/views/main/Main')).default,
        }),
      },
      {
        path: 'map',
        lazy: async () => ({
          Component: (await import('@/views/hall/map')).default,
        }),
      },
      {
        path: 'shifts',
        lazy: async () => ({
          Component: (await import('@/views/shifts/Shifts')).default,
        }),
      },
      {
        path: 'notes',
        lazy: async () => ({
          Component: (await import('@/views/notes/Notes')).default,
        }),
      },
      // ── Инструменты: landing + sub-tools. ──
      {
        path: 'tools',
        lazy: async () => ({
          Component: (await import('@/views/tools/ToolsView')).default,
        }),
      },
      {
        path: 'reminders',
        lazy: async () => ({
          Component: (await import('@/views/tools/RemindersView')).default,
        }),
      },
      {
        path: 'calculator',
        lazy: async () => ({
          Component: (await import('@/views/tools/CalculatorView')).default,
        }),
      },
      {
        path: 'menu',
        lazy: async () => ({
          Component: (await import('@/views/menu/MenuEditorView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'hall-editor',
        lazy: async () => ({
          Component: (await import('@/views/hall/HallEditorView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'order-history',
        lazy: async () => ({
          Component: (await import('@/views/order/OrderHistoryView')).default,
        }),
        handle: { hideBottomNav: true },
      },

      {
        path: 'profile',
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/views/profile/ProfileView')).default,
            }),
          },
          {
            path: 'appearance',
            lazy: async () => ({
              Component: (await import('@/views/profile/AppearanceView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'share',
            lazy: async () => ({
              Component: (await import('@/views/profile/ShareView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'workplaces',
            lazy: async () => ({
              Component: (await import('@/views/profile/WorkplacesView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'dev',
            lazy: async () => ({
              Component: (await import('@/views/profile/DevToolsView')).default,
            }),
            handle: { hideBottomNav: true },
          },
        ],
      },

      {
        path: 'onboarding',
        lazy: async () => ({
          Component: (await import('@/views/onboarding/OnboardingView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'bot-required',
        lazy: async () => ({
          Component: (await import('@/views/auth/BotRequiredView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'import',
        lazy: async () => ({
          Component: (await import('@/views/import/ImportFromCodeView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'order-builder',
        lazy: async () => ({
          Component: (await import('@/views/order/OrderBuilderView')).default,
        }),
        handle: { hideBottomNav: true },
      },
    ],
  },
])

export default router
