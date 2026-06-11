import { useMemo, useState } from 'react'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'

/**
 * Workplace switcher in screen headers.
 * - 1 workplace → plain label.
 * - 2+ → tap-to-open dropdown.
 *
 * Reactivity: select raw `items` + `currentId` and derive activeList/current
 * with useMemo (the store's activeList() getter would return a fresh array
 * each render — see the menu-store note from step 2).
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
    return <div className="switcher-label">{current?.title || 'Нет заведений'}</div>
  }

  return (
    <div className="switcher">
      <button className="switcher-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="switcher-trigger-text">{current?.title || 'Выберите'}</span>
        <span className={open ? 'switcher-chev switcher-chev--open' : 'switcher-chev'}>
          ▾
        </span>
      </button>

      {open && (
        <div
          className="switcher-menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="switcher-menu-list">
            {activeList.map((w) => (
              <button
                key={w.id}
                className={
                  w.id === currentId
                    ? 'switcher-menu-item switcher-menu-item--current'
                    : 'switcher-menu-item'
                }
                onClick={() => select(w.id)}
              >
                <span className="switcher-menu-item-text">{w.title}</span>
                {w.id === currentId && <span className="switcher-menu-check">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}