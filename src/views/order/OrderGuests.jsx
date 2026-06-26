import '@/styles/order-guests.css'

/**
 * "How many guests?" dialog shown when starting a new order.
 * 1 = single bill ("Один чек"); 2..10 = split the order per guest.
 */
export function GuestCountDialog({ onPick, onCancel }) {
  return (
    <div className="gcd-overlay">
      <div className="gcd">
        <h2 className="gcd-title">Сколько гостей?</h2>
        <p className="gcd-sub">«1» — один общий чек на стол</p>
        <div className="gcd-grid">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} className="gcd-num" onClick={() => onPick(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="gcd-hint">Число гостей можно изменить позже (кнопка «＋»).</p>
        <button className="gcd-back" onClick={onCancel}>
          Назад
        </button>
      </div>
    </div>
  )
}

/**
 * Horizontal guest switcher shown above the items.
 * - 1 guest → a single "Один чек" tab.
 * - 2+ → "Гость 1 … N", each removable (×), plus "＋" to add (up to 10).
 * `counts` is an optional map { [guest]: itemQty } for a small badge.
 */
export function GuestBar({ guestCount, selected, counts = {}, onSelect, onAdd, onRemove }) {
  const single = guestCount <= 1
  return (
    <div className="gb-scroll" role="tablist" aria-label="Гости">
      {Array.from({ length: guestCount }, (_, i) => i + 1).map((g) => {
        const on = g === selected
        const qty = counts[g] || 0
        return (
          <div key={g} className={on ? 'gb-chip gb-chip--on' : 'gb-chip'}>
            <button
              type="button"
              className="gb-chip-label"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(g)}
            >
              {single ? 'Один чек' : `Гость ${g}`}
              {qty > 0 && <span className="gb-chip-badge">{qty}</span>}
            </button>
            {!single && (
              <button
                type="button"
                className="gb-chip-x"
                aria-label={`Удалить гостя ${g}`}
                onClick={() => onRemove(g)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      {guestCount < 10 && (
        <button type="button" className="gb-add" onClick={onAdd} aria-label="Добавить гостя">
          ＋
        </button>
      )}
    </div>
  )
}
