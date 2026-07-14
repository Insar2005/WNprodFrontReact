import { useRef, useState } from 'react'
import { SearchIcon, CloseIcon } from '@/components/menu/menuIcons'

/**
 * Поле поиска по меню — вид 1:1 SearchBar из menu-redesign
 * (proto-guests.jsx): recessed-поле 40px, лупа слева, «×» справа.
 *
 * Историческая справка: раньше тут был дропдаун «Топ за смену» —
 * убран по просьбе заказчика (июнь 2026); имя файла оставлено ради
 * стабильного import-пути, вдруг вернём.
 *
 * Поверх прототипа сохранён «Скрыть» (только когда поле в фокусе и
 * пустое) — блюрит инпут, чтобы Telegram/iOS спрятали клавиатуру.
 *
 * Props:
 *   value          — текущий запрос (controlled)
 *   onChange       — (string) => void
 *   onFocusChange  — (boolean) => void — родитель прячет оверлеи
 *                    (шит корзины) на время клавиатуры. Опционально.
 *   placeholder
 */
export default function SearchWithTopOfShift({
  value,
  onChange,
  onFocusChange = null,
  placeholder = 'Поиск по меню…',
}) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)

  const setFocusState = (next) => {
    setFocused(next)
    onFocusChange?.(next)
  }

  const hideKeyboard = () => {
    // Именно blur убирает мобильную клавиатуру в Telegram WebApp.
    // focused=false ставим сами, чтобы «Скрыть» исчез мгновенно.
    setFocusState(false)
    inputRef.current?.blur()
  }

  return (
    <div className="wn-search">
      <div className="wn-search-box">
        <span className="wn-search-icon" aria-hidden>
          <SearchIcon width={18} height={18} />
        </span>
        <input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocusState(true)}
          onBlur={() => setFocusState(false)}
          inputMode="search"
          enterKeyHint="search"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {value ? (
          <button
            type="button"
            className="wn-search-clear"
            onClick={() => onChange('')}
            aria-label="Очистить"
          >
            <CloseIcon width={16} height={16} />
          </button>
        ) : focused ? (
          <button
            type="button"
            className="wn-search-hide"
            onMouseDown={(e) => e.preventDefault()}
            onClick={hideKeyboard}
            aria-label="Скрыть клавиатуру"
          >
            Скрыть
          </button>
        ) : null}
      </div>
    </div>
  )
}
