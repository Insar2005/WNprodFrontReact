import { useRef, useState } from 'react'

/**
 * Menu search input.
 *
 * Was: input + "Top of shift" dropdown that showed the user's most-clicked
 * items on focus. The dropdown was removed at customer request (June 2026)
 * because it kept opening at inopportune moments and blocked the menu
 * behind it. The file keeps the same name/import path for continuity —
 * we might revive the dropdown later.
 *
 * Now: plain input with two trailing controls that swap in and out:
 *   • "×" (clear) — shown when the field has text; wipes the query.
 *   • "Скрыть" — shown when the input has focus (keyboard is docked on
 *     mobile); blurs the input which lets Telegram/iOS dismiss the
 *     keyboard.
 *
 * Props:
 *   value          — current query (controlled)
 *   onChange       — (string) => void
 *   onFocusChange  — (boolean) => void, notified on focus/blur so the
 *                    parent can hide overlays that shouldn't be in the
 *                    way of the keyboard (cart sheet, submit button).
 *                    Optional — pass null to opt out.
 *   placeholder    — placeholder text
 *   shiftId, items, categoryById, onPick — no longer used; kept for
 *                    API compatibility. Removing them from the caller
 *                    is fine, but leaving them in place is harmless.
 */
export default function SearchWithTopOfShift({
  value,
  onChange,
  onFocusChange = null,
  placeholder = 'Поиск по меню…',
  // Kept to match the previous prop signature — see note above.
  // eslint-disable-next-line no-unused-vars
  shiftId,
  // eslint-disable-next-line no-unused-vars
  items,
  // eslint-disable-next-line no-unused-vars
  categoryById,
  // eslint-disable-next-line no-unused-vars
  onPick,
}) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  const setFocusState = (next) => {
    setFocused(next)
    onFocusChange?.(next)
  }

  const hideKeyboard = () => {
    // Blurring the input is what actually dismisses the mobile keyboard
    // in Telegram WebApp. We also flip focused=false ourselves so the
    // "Скрыть" button hides immediately (before the browser's blur
    // event lands) — feels snappier.
    setFocusState(false)
    inputRef.current?.blur()
  }

  return (
    <div className="search-wrap search-tof">
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocusState(true)}
        onBlur={() => setFocusState(false)}
        // Hint to mobile keyboards: search action, no autocorrect UI.
        inputMode="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Очистить"
        >
          ×
        </button>
      ) : focused ? (
        // The "Скрыть" pill only appears in the empty-field focused state
        // — it's the moment when the user has a keyboard up but can't
        // easily get rid of it. Once they type something, "×" (clear)
        // is more useful and replaces it. On desktop this button is
        // essentially decorative (no keyboard to hide) but harmless.
        <button
          type="button"
          className="search-hide-kb"
          onMouseDown={(e) => e.preventDefault()}
          onClick={hideKeyboard}
          aria-label="Скрыть клавиатуру"
        >
          Скрыть
        </button>
      ) : null}
    </div>
  )
}