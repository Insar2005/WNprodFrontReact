import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import { initTelegram } from '@/utils/telegram'
import { initSentry, sentrySetUser } from '@/utils/sentry'
import './styles/global.css'

// ── Vue → React mapping ─────────────────────────────────────────────
// Vue:                              React:
//   createApp(App)                    createRoot(el)
//   app.use(createPinia())            (no global register — Zustand
//                                      stores are imported where used)
//   app.use(router)                   <RouterProvider router={router} />
//   app.mount('#app')                 root.render(...)
// ────────────────────────────────────────────────────────────────────

// Sentry — до всего остального, чтобы ловить и ошибки инициализации.
initSentry()

// Telegram WebApp init runs before render, exactly as in the Vue version.
initTelegram()
sentrySetUser(window.Telegram?.WebApp?.initDataUnsafe?.user)

createRoot(document.getElementById('app')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)