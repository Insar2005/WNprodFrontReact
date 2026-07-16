import { useMemo, useState } from 'react'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { ChevronDown, CheckIcon } from '@/components/menu/menuIcons'
import '@/styles/home-shifts.css'

/**
 * Переключатель заведения в шапках экранов — 1:1 из прототипа
 * waiter-note-unified (home-screens.jsx HmHeader).
 *
 *   • 1 заведение → просто лейбл (13 mute).
 *   • 2+ → пилюля «название + шеврон» (шеврон крутится на 180°);
 *     тап открывает выпадающее меню (elevated, radius 12, тень —
 *     плавающий элемент), у текущего галочка accent-text. Клик по
 *     подложке закрывает.
 *
 * Общий компонент: Главная, Карта, Заметки.
 */
export default function WorkplaceSwitcher() {
  const items = useWorkplaceStore((s) => s.items)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const [open, setOpen] = useState(false)

  const activeList = useMemo(
    () =>
      [...items]
        .filter((w) => !w.is_archived)
        .sort((a, b) => a.position - b.position),
    [items],
  )
  const current = useMemo(
    () => items.find((w) => w.id === currentId) ?? null,
    [items, currentId],
  )

  const select = async (id) => {
    setOpen(false)
    if (id === currentId) return
    try {
      await useWorkplaceStore.getState().setCurrent(id)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  if (activeList.length <= 1) {
    return <span className="switcher-label">{current?.title || 'Нет заведений'}</span>
  }

  return (
    <div className="switcher">
      <button
        type="button"
        className="switcher-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="switcher-trigger-text">{current?.title || 'Выберите'}</span>
        <span className={`switcher-chev${open ? ' switcher-chev--open' : ''}`} aria-hidden>
          <ChevronDown width={13} height={13} />
        </span>
      </button>

      {open && (
        <>
          <div className="switcher-backdrop" onClick={() => setOpen(false)} />
          <div className="switcher-menu">
            {activeList.map((w) => {
              const on = w.id === currentId
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`switcher-item${on ? ' switcher-item--current' : ''}`}
                  onClick={() => select(w.id)}
                >
                  <span className="switcher-item-text">{w.title}</span>
                  {on && (
                    <span className="switcher-check" aria-hidden>
                      <CheckIcon width={16} height={16} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
