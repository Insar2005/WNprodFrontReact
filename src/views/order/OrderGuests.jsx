import '@/styles/order-guests.css'

/**
 * Диалог «Сколько гостей?».
 *
 * ⚠️ Июль 2026 (редизайн menu-redesign): в OrderBuilder больше НЕ
 * используется — число гостей задаётся только горизонтальным списком
 * GuestBar («＋» добавить, «×» удалить), отдельного пикера в дизайне
 * нет. Компонент и стили оставлены на случай отката.
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
 * Горизонтальный свитчер гостей над позициями — 1:1 GuestBar из
 * menu-redesign (proto-guests.jsx).
 *
 *   • 1 гость → одиночный чип «Один чек» (без «×»).
 *   • 2+ → «Гость 1 … N», у каждого «×» (удалить), «＋» добавляет
 *     (до 10). Активный чип — accent-fill с полупрозрачной акцентной
 *     рамкой; бейдж количества: у активного — сплошной акцент/белый,
 *     у остальных — recessed/mute.
 *
 * `counts` — опциональная map { [guest]: qty } для бейджа.
 */
export function GuestBar({ guestCount, selected, counts = {}, onSelect, onAdd, onRemove }) {
  const single = guestCount <= 1
  return (
    <div className="gb-scroll" role="tablist" aria-label="Гости">
      {Array.from({ length: guestCount }, (_, i) => i + 1).map((g) => {
        const on = g === selected
        const qty = counts[g] || 0
        const cls = [
          'gb-chip',
          on ? 'gb-chip--on' : '',
          single ? 'gb-chip--single' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div key={g} className={cls}>
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
