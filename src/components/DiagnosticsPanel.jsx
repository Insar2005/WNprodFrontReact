import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/stores/ui'

/**
 * Text-input modal, promise-based (ui.prompt(...) resolves with the string
 * or null on cancel). Anchored near the top so the on-screen keyboard never
 * covers it — that's the whole reason it exists instead of inline inputs.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - In Vue this was two files: PromptHost.vue (reads the store) +
 *   PromptModal.vue (the dumb modal). Merged here — there's only ever one
 *   host, so a separate reusable modal added no value.
 * - v-model → controlled input (value in useState).
 * - The Vue watch(visible) reset value + autofocused on each open. The
 *   React-idiomatic way to "reset state when identity changes" is the
 *   `key` prop: PromptHost reads the store and renders <PromptModalInner
 *   key={...}> — a fresh dialog gives a new key, so the inner component
 *   REMOUNTS, and its useState(initial) seeds the value naturally. No
 *   setState-in-effect needed (which the newer react-hooks lint flags).
 *   The effect that remains only does focus — a real side effect.
 * - inputRef → useRef. Enter confirms (single-line), Esc cancels.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function PromptHost() {
  const dialog = useUiStore((s) => s.promptDialog)
  const resolvePrompt = useUiStore((s) => s.resolvePrompt)

  if (!dialog) return null

  // Key on the per-open token set by ui.prompt(). A fresh prompt → new
  // token → PromptModalInner remounts → its useState(initial) reseeds.
  return (
    <PromptModalInner
      key={dialog._token}
      dialog={dialog}
      onConfirm={(v) => resolvePrompt(v)}
      onCancel={() => resolvePrompt(null)}
    />
  )
}

function PromptModalInner({ dialog, onConfirm, onCancel }) {
  const {
    title = 'Введите значение',
    initial = '',
    placeholder = '',
    multiline = false,
    rows = 4,
    inputType = 'text',
    inputMode = 'text',
    maxLength = 2000,
    confirmText = 'Сохранить',
    cancelText = 'Отмена',
    required = false,
  } = dialog

  // Seeded once on mount — remount (new key) reseeds. No effect needed.
  const [value, setValue] = useState(initial)
  const inputRef = useRef(null)

  // Focus on mount. Two rAFs: iOS sometimes ignores the first focus.
  useEffect(() => {
    let r2 = 0
    const r1 = requestAnimationFrame(() => {
      inputRef.current?.focus()
      r2 = requestAnimationFrame(() => inputRef.current?.focus())
    })
    return () => {
      cancelAnimationFrame(r1)
      if (r2) cancelAnimationFrame(r2)
    }
  }, [])

  const canConfirm = !required || (value || '').trim().length > 0

  const confirm = () => {
    if (!canConfirm) return
    onConfirm(value)
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      confirm()
    }
  }

  return (
    <div className="prompt-overlay" onClick={onOverlayClick}>
      <div className="prompt-modal wn-prompt-in" role="dialog" aria-modal="true">
        <header className="prompt-header">
          <h3 className="prompt-title">{title}</h3>
          <button className="prompt-close" onClick={onCancel} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="prompt-body">
          {multiline ? (
            <textarea
              ref={inputRef}
              className="prompt-input prompt-input--multiline"
              placeholder={placeholder}
              maxLength={maxLength}
              rows={rows}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
            />
          ) : (
            <input
              ref={inputRef}
              className="prompt-input"
              type={inputType}
              placeholder={placeholder}
              maxLength={maxLength}
              inputMode={inputMode}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
            />
          )}
        </div>

        <footer className="prompt-footer">
          <button className="btn btn--ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="btn btn--primary" disabled={!canConfirm} onClick={confirm}>
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  )
}