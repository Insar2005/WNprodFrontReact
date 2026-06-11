import { useNavigate } from 'react-router-dom'
import { useUiStore } from '@/stores/ui'

/**
 * Dev tools — only reachable when USE_MOCK is true (Profile gates the row).
 * Seeds / resets the local mock DB.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - The dynamic import('@/mocks/db') is kept as-is; it lazy-loads the mock
 *   DB only when a button is tapped, so the real-backend build never pulls
 *   it in. NOTE: our mocks/db is currently a stub — seedDemo/resetDb throw
 *   "not ported" until the full mock backend is migrated. The screen
 *   degrades gracefully (shows the error toast) rather than crashing.
 * - router.back() fallback → navigate(-1) / navigate('/profile').
 * ─────────────────────────────────────────────────────────────────────
 */
export default function DevToolsView() {
  const navigate = useNavigate()

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/profile')
  }

  const onSeed = async () => {
    const ui = useUiStore.getState()
    try {
      const { seedDemo } = await import('@/mocks/db')
      seedDemo()
      ui.toastSuccess('Заполнено. Перезагрузка…')
      setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      ui.toastError(e.message || 'Не удалось заполнить демо')
    }
  }

  const onResetMock = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Сбросить всё?',
      message:
        'Все workplace, столы, меню, смены и заметки будут удалены. Это локальная mock БД.',
      confirmText: 'Сбросить',
      danger: true,
    })
    if (!ok) return
    try {
      const { resetDb } = await import('@/mocks/db')
      resetDb()
      ui.toastSuccess('Сброшено. Перезагрузка…')
      setTimeout(() => window.location.reload(), 600)
    } catch (e) {
      ui.toastError(e.message)
    }
  }

  return (
    <div className="page">
      <header className="sub-header">
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
        <h1 className="sub-title">Dev tools</h1>
      </header>

      <section className="dev-card">
        <p className="dev-hint">
          Эти кнопки видны только в dev-сборке при USE_MOCK=true. Работают с
          локальной mock БД, не трогая реальный сервер.
        </p>
        <div className="dev-actions">
          <button className="btn-dev" onClick={onSeed}>
            📦 Заполнить демо-данными
          </button>
          <button className="btn-dev btn-dev--danger" onClick={onResetMock}>
            🗑 Сбросить mock БД
          </button>
        </div>
      </section>
    </div>
  )
}