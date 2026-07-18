import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'

/**
 * Корневой error boundary приложения (errorElement роутера).
 *
 * Главный сценарий: после деплоя на Firebase у юзера в вебвью закэширован
 * старый index.html — он просит JS-чанки прошлой сборки, которых на
 * хостинге уже нет; SPA-rewrite отдаёт вместо них index.html, и импорт
 * падает с «'text/html' is not a valid JavaScript MIME type». Лечится
 * перезагрузкой — делаем её сами, один раз (guard в sessionStorage,
 * чтобы не зациклиться, если проблема не в кэше).
 *
 * Остальные ошибки показывают человеческий экран с кнопкой вместо
 * дефолтного «Hey developer» React Router.
 */
const RELOAD_FLAG = 'wn-chunk-reload'

function isStaleChunkError(error) {
  const msg = String(error?.message || error || '')
  return (
    msg.includes('not a valid JavaScript MIME type') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  )
}

export default function AppErrorBoundary() {
  const error = useRouteError()
  const stale = isStaleChunkError(error)
  const canAutoReload = stale && !sessionStorage.getItem(RELOAD_FLAG)

  useEffect(() => {
    if (canAutoReload) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }, [canAutoReload])

  // Секунда чёрного экрана перед авто-перезагрузкой — без текста, чтобы
  // не мигать сообщением, которое юзер не успеет прочитать.
  if (canAutoReload) return <div className="app-error" />

  return (
    <div className="app-error">
      <div className="app-error-card">
        <div className="app-error-title">
          {stale ? 'Вышло обновление' : 'Что-то пошло не так'}
        </div>
        <div className="app-error-text">
          {stale
            ? 'Приложение обновилось на сервере. Нажмите кнопку, чтобы загрузить свежую версию.'
            : 'Произошла ошибка. Попробуйте перезагрузить приложение — обычно этого достаточно.'}
        </div>
        <button
          type="button"
          className="app-error-btn"
          onClick={() => {
            sessionStorage.removeItem(RELOAD_FLAG)
            window.location.reload()
          }}
        >
          Перезагрузить
        </button>
      </div>
    </div>
  )
}