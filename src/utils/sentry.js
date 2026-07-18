import * as Sentry from '@sentry/react'

/**
 * Sentry — только ошибки (без трейсинга и реплеев): дёшево и достаточно
 * для запуска. Включается наличием VITE_SENTRY_DSN в env; без DSN —
 * полный no-op, локальная разработка и демо не шлют ничего.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [],
    tracesSampleRate: 0,
    // Телеграм-вебвью плодит дубли от перезапусков — режем повторы.
    ignoreErrors: ['ResizeObserver loop', 'AbortError'],
  })
}

/** Привязка юзера к событиям (вызывается после initTelegram). */
export function sentrySetUser(tgUser) {
  if (!tgUser?.id) return
  Sentry.setUser({ id: String(tgUser.id), username: tgUser.username })
}