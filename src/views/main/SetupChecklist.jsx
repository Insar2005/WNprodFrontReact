import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useHallStore } from '@/stores/hall'
import { useMenuStore } from '@/stores/menu'
import { useShiftStore } from '@/stores/shift'
import { CheckIcon, ChevronRight } from '@/components/menu/menuIcons'

/**
 * «Быстрый старт» — карточка онбординга на Главной. Показывается, пока
 * не пройдены три шага после создания заведения: залы со столами, меню,
 * первая смена. Каждый ряд ведёт в нужный экран; следующий несделанный
 * шаг подсвечен. Когда всё готово — карточка исчезает навсегда (по
 * данным, без флагов в сторадже).
 *
 * Кейс «нет заведения» карточка не покрывает — его ведёт существующий
 * блок hm-novenue на Главной.
 */
export default function SetupChecklist() {
  const navigate = useNavigate()
  const currentId = useWorkplaceStore((s) => s.currentId)

  const halls = useHallStore((s) => s.halls)
  const menuItems = useMenuStore((s) => s.items)
  const menuCategories = useMenuStore((s) => s.categories)
  const shift = useShiftStore((s) => s.current)
  const shiftHistory = useShiftStore((s) => s.history)

  // Ленивая догрузка данных для честных галочек — по разу за маунт.
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (!currentId || fetchedRef.current) return
    fetchedRef.current = true
    const hall = useHallStore.getState()
    const menu = useMenuStore.getState()
    const shifts = useShiftStore.getState()
    if (hall.halls.length === 0) hall.fetchAll?.(currentId)?.catch?.(() => {})
    if (menu.items.length === 0 && menu.categories.length === 0) {
      menu.fetchAll?.(currentId, { activeOnly: true })?.catch?.(() => {})
    }
    if (!shifts.current && shifts.history.length === 0 && shifts.historyHasMore) {
      shifts.fetchHistory?.(currentId)?.catch?.(() => {})
    }
  }, [currentId])

  const steps = useMemo(() => {
    const hallsDone = halls.length > 0
    const menuDone = menuItems.length > 0 || menuCategories.length > 0
    const shiftDone = !!shift || shiftHistory.length > 0
    return [
      {
        key: 'halls',
        done: hallsDone,
        title: 'Залы и столы',
        sub: 'Создайте зал и расставьте столы в редакторе карты',
        to: '/hall-editor',
      },
      {
        key: 'menu',
        done: menuDone,
        title: 'Меню',
        sub: 'Заполните вручную — или пришлите фото меню Кибер Шефу, он импортирует сам',
        to: '/menu',
      },
      {
        key: 'shift',
        done: shiftDone,
        title: 'Первая смена',
        sub: 'Откройте смену — и можно принимать заказы',
        to: '/shifts',
      },
    ]
  }, [halls.length, menuItems.length, menuCategories.length, shift, shiftHistory.length])

  if (!currentId) return null
  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null
  const nextKey = steps.find((s) => !s.done)?.key

  return (
    <section className="hm-setup" aria-label="Быстрый старт">
      <div className="hm-setup-head">
        <span className="hm-setup-title">Быстрый старт</span>
        <span className="hm-setup-progress">
          {doneCount} из {steps.length}
        </span>
      </div>
      {steps.map((s) => {
        const isNext = s.key === nextKey
        return (
          <button
            key={s.key}
            type="button"
            className={`hm-setup-row${isNext ? ' hm-setup-row--next' : ''}`}
            onClick={() => navigate(s.to)}
          >
            <span
              className={`hm-setup-circle${s.done ? ' hm-setup-circle--done' : ''}`}
              aria-hidden
            >
              {s.done && <CheckIcon width={14} height={14} />}
            </span>
            <span className="hm-setup-main">
              <span className={`hm-setup-step${s.done ? ' hm-setup-step--done' : ''}`}>
                {s.title}
              </span>
              {!s.done && <span className="hm-setup-sub">{s.sub}</span>}
            </span>
            {!s.done && (
              <span className="hm-setup-chevron" aria-hidden>
                <ChevronRight width={16} height={16} />
              </span>
            )}
          </button>
        )
      })}
    </section>
  )
}