import { useEffect, useRef, useState } from 'react'

/**
 * Per-dish comment modal with quick chips.
 *
 * Chips come from the item's own `comment_chips` (set per position in the
 * menu editor) — NOT a global hardcoded list. Tapping a chip toggles that
 * phrase in/out of the comment text (comma-joined). The waiter can also
 * free-type in the textarea.
 *
 * Bottom-sheet styled to match the app's other sheets (.sheet-overlay /
 * .sheet), so the fullscreen safe-area + keyboard fixes already apply.
 *
 * Props:
 *   item     — { title, comment_chips?: string[] }
 *   initial  — existing comment string
 *   onClose  — () => void
 *   onSave   — (text) => void  (trimmed)
 */
export default function CommentModal({ item, initial = '', onClose, onSave }) {
  const [draft, setDraft] = useState(initial || '')
  const taRef = useRef(null)

  useEffect(() => {
    const r = requestAnimationFrame(() => taRef.current?.focus())
    return () => cancelAnimationFrame(r)
  }, [])

  const chips = Array.isArray(item?.comment_chips) ? item.comment_chips : []

  // Current phrases parsed from the comma-joined draft.
  const phrases = draft
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const has = (c) => phrases.includes(c)
  const toggle = (c) => {
    const next = has(c) ? phrases.filter((p) => p !== c) : [...phrases, c]
    setDraft(next.join(', '))
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet cm-sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title cm-title">
            <span>Комментарий: {item?.title}</span>
          </h3>
          <button
            className="sheet-close"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="sheet-form">
          <textarea
            ref={taRef}
            className="cm-textarea"
            rows={3}
            maxLength={2000}
            placeholder="Например: без сахара"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          {chips.length > 0 && (
            <div className="cm-chips-block">
              <div className="cm-chips-label">Частые</div>
              <div className="cm-chips">
                {chips.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`cm-chip${has(c) ? ' cm-chip--on' : ''}`}
                    onClick={() => toggle(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sheet-actions">
            <div className="sheet-actions-spacer" />
            <button className="btn btn--ghost" onClick={() => onClose?.()}>
              Отмена
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onSave?.(draft.trim())}
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}