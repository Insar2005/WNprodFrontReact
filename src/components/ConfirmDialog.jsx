import { useUiStore } from '@/stores/ui'

/**
 * Promise-based confirm dialog. Renders when ui.confirmDialog is set;
 * resolveConfirm(true/false) settles the promise the caller awaited.
 *
 * Vue used <transition name="fade">; here entry is a CSS keyframe
 * (wn-overlay-in / wn-dialog-in). Clicking the backdrop = cancel.
 */
export default function ConfirmDialog() {
  const dialog = useUiStore((s) => s.confirmDialog)
  const resolveConfirm = useUiStore((s) => s.resolveConfirm)

  if (!dialog) return null

  const ok = () => resolveConfirm(true)
  const cancel = () => resolveConfirm(false)

  // Only treat clicks that land on the overlay itself (not its children).
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) cancel()
  }

  return (
    <div className="overlay wn-overlay-in" onClick={onOverlayClick}>
      <div className="dialog wn-dialog-in" role="dialog" aria-modal="true">
        <h3 className="dialog-title">{dialog.title}</h3>
        {dialog.message && <p className="dialog-message">{dialog.message}</p>}
        <div className="dialog-actions">
          <button className="btn btn--ghost" onClick={cancel}>
            {dialog.cancelText}
          </button>
          <button
            className={`btn ${dialog.danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={ok}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}