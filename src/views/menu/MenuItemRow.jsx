import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/utils/format'
import { InfoIcon, PencilIcon, MinusIcon } from '@/components/menu/menuIcons'

/**
 * Универсальная строка позиции — 1:1 ItemRow / SearchResultRow из
 * menu-redesign (proto-ui.jsx, proto-guests.jsx).
 *
 *   • `pick` — OrderBuilder. Тап по карточке = +1 активному гостю
 *     (микро-«bump»). Слева ⓘ (onInfo → карточка позиции). При qty>0 —
 *     бейдж количества у названия (сплошной акцент, белая цифра) и
 *     выезжающий слева флажок «−» (onDec). НИКАКОЙ заливки карточки —
 *     карточка остаётся плоской elevated с hairline-границей.
 *   • `edit` — редактор меню. Тап = открыть форму. Слева карандаш;
 *     скрытая позиция — opacity 0.55 + бейдж «скрыто».
 *
 * pathLabel (только результаты поиска): строка становится двухэтажной —
 * название сверху, путь «Категория › Подкатегория» под ним (12px mute),
 * как SearchResultRow в прототипе.
 *
 * `highlighted`: короткий пульс + scrollIntoView (поиск → категория).
 */
export default function MenuItemRow({
  item,
  currency = 'RUB',
  mode = 'pick',
  quantity = 0,
  pathLabel = null,
  highlighted = false,
  onClick,
  onInfo,
  onDec,
}) {
  const rowRef = useRef(null)
  const [bump, setBump] = useState(false)

  // Синхронизация с внешней системой (позиция скролла DOM) — законный
  // useEffect, состояние React не трогаем.
  useEffect(() => {
    if (highlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlighted])

  const hidden = mode === 'edit' && item.is_active === false
  const inCart = mode === 'pick' && quantity > 0
  const showFlag = inCart && !!onDec
  const stacked = !!pathLabel

  const shellCls = ['mir-shell', showFlag ? 'mir-shell--flagged' : '']
    .filter(Boolean)
    .join(' ')
  const rowCls = [
    'mir-row',
    hidden ? 'mir-row--hidden' : '',
    highlighted ? 'mir-row--highlight' : '',
    bump ? 'mir-row--bump' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = () => {
    if (mode === 'pick') setBump(true)
    onClick?.(item)
  }
  const handleInfo = (e) => {
    // Не всплываем — иначе сработает onClick строки и добавит в корзину.
    e.stopPropagation()
    onInfo?.(item)
  }
  const handleDec = (e) => {
    e.stopPropagation()
    onDec?.(item)
  }

  const badges = (
    <>
      {hidden && <span className="mir-badge">скрыто</span>}
      {inCart && <span className="mir-qty">{quantity}</span>}
    </>
  )

  return (
    <div className={shellCls}>
      {/* Флажок «−» под строкой; открывается сдвигом padding-left. */}
      {mode === 'pick' && onDec && (
        <button
          type="button"
          className="mir-dec-flag"
          onClick={handleDec}
          aria-label="Убрать одну"
          tabIndex={showFlag ? 0 : -1}
        >
          <MinusIcon width={22} height={22} />
        </button>
      )}

      <div
        ref={rowRef}
        className={rowCls}
        onClick={handleClick}
        onAnimationEnd={() => setBump(false)}
      >
        {mode === 'pick' && onInfo && (
          <button
            type="button"
            className="mir-info-btn"
            onClick={handleInfo}
            aria-label="Подробнее"
          >
            <InfoIcon width={22} height={22} />
          </button>
        )}
        {mode === 'edit' && (
          <span className="mir-edit-hint" aria-hidden="true">
            <PencilIcon width={20} height={20} />
          </span>
        )}

        <div
          className={
            stacked ? 'mir-title-wrap mir-title-wrap--stacked' : 'mir-title-wrap'
          }
        >
          {stacked ? (
            <>
              <span className="mir-title-line">
                <span className="mir-title">{item.title}</span>
                {badges}
              </span>
              <span className="mir-path">{pathLabel}</span>
            </>
          ) : (
            <>
              <span className="mir-title">{item.title}</span>
              {badges}
            </>
          )}
        </div>

        <div className="mir-right">
          {item.portion && <span className="mir-portion">{item.portion}</span>}
          <span className="mir-price">{formatMoney(item.price, currency)}</span>
        </div>
      </div>
    </div>
  )
}
