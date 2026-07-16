import '@/styles/wn-sheet.css'

/**
 * Полноэкранный низ-шит — 1:1 WnSheet из прототипа waiter-note-unified.
 * Панель от 48px сверху, фон страницы (не elevated), ручка, заголовок +
 * круглая «×», скроллящееся тело. Оверлей — глобальный .sheet-overlay:
 * тап по фону закрывает, нижняя навигация прячется, fullscreen-паддинг
 * Telegram уже решён в global.css.
 *
 * Используют отчёт по смене и карточка заказа.
 */
export default function WnSheet({ title, onClose, children }) {
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }
  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="wns-panel" role="dialog" aria-modal="true">
        <div className="wns-handle" aria-hidden />
        <div className="wns-head">
          <span className="wns-title">{title}</span>
          <button
            type="button"
            className="wns-close"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="wns-body">{children}</div>
      </div>
    </div>
  )
}
