import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { useRemindersStore } from '@/stores/reminders'
import { useNow } from '@/hooks/useNow'
import { formatMoney } from '@/utils/format'
import { pluralize } from '@/utils/pluralize'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import {
  BellIcon,
  CheckIcon,
  ChevronRight,
} from '@/components/menu/menuIcons'
import '@/styles/home-shifts.css'

/**
 * Главная — 1:1 по прототипу waiter-note-unified (home-redesign/
 * home-screens.jsx). Рабочий стол официанта во время смены: активные
 * заказы и то, что требует внимания. Виджета смены (таймер/заработано)
 * здесь НЕТ — для этого вкладка «Смены».
 *
 *   • Шапка: приветствие по времени суток + дата, справа переключатель
 *     заведений (пилюля с меню).
 *   • Ближайшее напоминание (невыполненное, до +24 ч или просроченное):
 *     колокольчик · текст · «сегодня/завтра HH:MM» (просрочено — warn) ·
 *     чек-кнопка (уводит строку за 250 мс и отмечает в сторе). Тап по
 *     строке → раздел «Напоминания».
 *   • «Активные заказы»: счётчик-бейдж, «История ›», «На столах: сумма»,
 *     фильтры Все/Не подано/Долгие (видны при ≥4 заказах), карточки
 *     «Стол №4 · Зал / 7 позиций · подано 3 из 7 · 25 мин / сумма».
 *     >30 мин — warn-точка и warn-время. «N мин» тикают раз в 30 с.
 *     Тап → карта с деталями заказа.
 *   • Смена закрыта → CTA-карточка «Открыть» (ведёт в Смены).
 *   • Нет заведений → карточка-онбординг.
 *
 * FAB «Взять заказ» — глобальный (components/PrimaryAction), контент
 * получает нижний паддинг под него.
 */

const LONG_MIN = 30

function itemCount(o) {
  return (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0)
}
function servedCount(o) {
  return (o.items || [])
    .filter((i) => i.served)
    .reduce((s, i) => s + (i.quantity || 0), 0)
}

/* ── Строка ближайшего напоминания ── */
function ReminderRow({ reminder, nowMs, onOpen }) {
  const [checked, setChecked] = useState(false)
  const [gone, setGone] = useState(false)
  const overdue = reminder.remind_at * 1000 < nowMs

  const whenLabel = (() => {
    const d = new Date(reminder.remind_at * 1000)
    const sameDay = d.toDateString() === new Date(nowMs).toDateString()
    const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    return `${sameDay ? 'сегодня' : 'завтра'} ${hm}`
  })()

  const check = (e) => {
    e.stopPropagation()
    if (checked) return
    setChecked(true)
    setTimeout(() => setGone(true), 350)
    setTimeout(() => {
      useRemindersStore.getState().toggleDone(reminder.id).catch(() => {})
    }, 620)
  }

  return (
    <div className={`hm-rem-wrap${gone ? ' hm-rem-wrap--gone' : ''}`}>
      <div className="hm-rem" onClick={onOpen}>
        <span className="hm-rem-bell" aria-hidden>
          <BellIcon width={19} height={19} />
        </span>
        <span className="hm-rem-main">
          <span className={`hm-rem-text${checked ? ' hm-rem-text--checked' : ''}`}>
            {reminder.text}
          </span>
          <span className={`hm-rem-when${overdue ? ' hm-rem-when--overdue' : ''}`}>
            {whenLabel}
          </span>
        </span>
        <button
          type="button"
          className={`hm-rem-check${checked ? ' hm-rem-check--on' : ''}`}
          aria-label="Выполнено"
          onClick={check}
        >
          {checked && <CheckIcon width={15} height={15} />}
        </button>
      </div>
    </div>
  )
}

/* ── Карточка активного заказа ── */
function OrderCard({ order, nowMs, currency, onTap }) {
  const pos = itemCount(order)
  const served = servedCount(order)
  const mins = Math.max(0, Math.floor((nowMs / 1000 - Number(order.created_at)) / 60))
  const long = mins > LONG_MIN
  const all = pos > 0 && served >= pos

  return (
    <button type="button" className="hm-order" onClick={onTap}>
      <span className="hm-order-main">
        <span className="hm-order-title">
          {order.table_number != null ? (
            <>
              <span className="hm-order-table">Стол №{order.table_number}</span>
              {order.hall_name && <span className="hm-order-hall">{order.hall_name}</span>}
            </>
          ) : (
            <span className="hm-order-table hm-order-table--none">Без стола</span>
          )}
        </span>
        <span className="hm-order-meta">
          <span>{pos} {pluralize(pos, ['позиция', 'позиции', 'позиций'])}</span>
          <span>·</span>
          {all ? (
            <span className="hm-order-served-all">подано всё</span>
          ) : (
            <span>подано {served} из {pos}</span>
          )}
          <span>·</span>
          {long && <span className="hm-order-warndot" aria-hidden />}
          <span className={`hm-order-mins${long ? ' hm-order-mins--warn' : ''}`}>
            {mins} мин
          </span>
        </span>
      </span>
      <span className="hm-order-sum">{formatMoney(order.total_price, currency)}</span>
      <span className="hm-order-chev" aria-hidden>
        <ChevronRight width={16} height={16} />
      </span>
    </button>
  )
}

export default function Main() {
  const navigate = useNavigate()

  const userName = useAuthStore((s) => s.user?.username || '')
  const workplaces = useWorkplaceStore((s) => s.items)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')
  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const orders = useOrderStore((s) => s.orders)
  const reminders = useRemindersStore((s) => s.items)
  const remindersLoaded = useRemindersStore((s) => s.loaded)

  const [filter, setFilter] = useState('all')
  const now = useNow(30_000) // «N мин» тикают раз в 30 с
  const nowMs = now.getTime()

  const isEmpty = workplaces.length === 0

  // Напоминания подгружаем лениво (раздел мог ещё не открываться).
  useEffect(() => {
    if (!remindersLoaded) {
      useRemindersStore.getState().fetchAll().catch(() => {})
    }
  }, [remindersLoaded])

  // Ближайшее невыполненное: просроченное или в ближайшие 24 ч.
  const nearestReminder = useMemo(() => {
    const horizon = nowMs / 1000 + 24 * 3600
    return (
      [...reminders]
        .filter((r) => !r.is_done && r.remind_at <= horizon)
        .sort((a, b) => a.remind_at - b.remind_at)[0] || null
    )
  }, [reminders, nowMs])

  const activeOrders = useMemo(
    () =>
      orders
        .filter((o) => !o.is_paid)
        .sort((a, b) => (a.created_at || 0) - (b.created_at || 0)), // старые сверху
    [orders],
  )
  const activeRevenue = useMemo(
    () => activeOrders.reduce((s, o) => s + (o.total_price || 0), 0),
    [activeOrders],
  )
  const filtered = useMemo(
    () =>
      activeOrders.filter((o) => {
        if (filter === 'unserved') return servedCount(o) < itemCount(o)
        if (filter === 'long') {
          return (nowMs / 1000 - Number(o.created_at)) / 60 > LONG_MIN
        }
        return true
      }),
    [activeOrders, filter, nowMs],
  )

  const greeting = (() => {
    const h = new Date().getHours()
    if (h >= 23 || h < 5) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 17) return 'Добрый день'
    return 'Добрый вечер'
  })()
  const todayLabel = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const openOrderOnMap = (o) => navigate(`/map?show_order=${encodeURIComponent(o.id)}`)

  const chips = [
    ['all', 'Все'],
    ['unserved', 'Не подано'],
    ['long', 'Долгие'],
  ]

  return (
    <div className="page hm-page">
      <header className="hm-header">
        <div className="hm-header-main">
          <h1 className="hm-greeting">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </h1>
          <p className="hm-date">{todayLabel}</p>
        </div>
        {/* <WorkplaceSwitcher /> */}
      </header>

      {isEmpty ? (
        <div className="hm-novenue-wrap">
          <div className="hm-novenue">
            <div className="hm-novenue-title">Сначала создайте заведение</div>
            <div className="hm-novenue-text">
              Заведение — это место работы. Можно настроить меню, столы,
              начислять смены.
            </div>
            <button
              type="button"
              className="hm-novenue-btn"
              onClick={() => navigate('/profile')}
            >
              Перейти в профиль
            </button>
          </div>
        </div>
      ) : (
        <div className={`hm-body${isOpen && currentId ? ' hm-body--fab' : ''}`}>
          {nearestReminder && (
            <ReminderRow
              reminder={nearestReminder}
              nowMs={nowMs}
              onOpen={() => navigate('/reminders')}
            />
          )}

          {isOpen ? (
            <section>
              <div className="hm-sec-head">
                <h2 className="hm-sec-title">Активные заказы</h2>
                {activeOrders.length > 0 && (
                  <span className="hm-sec-count">{activeOrders.length}</span>
                )}
                <span className="hm-sec-spacer" />
                <button
                  type="button"
                  className="hm-history-link"
                  onClick={() => navigate('/order-history')}
                >
                  История ›
                </button>
              </div>

              {activeOrders.length > 0 && (
                <div className="hm-sec-sub">
                  На столах: {formatMoney(activeRevenue, currency)}
                </div>
              )}

              {activeOrders.length >= 4 && (
                <div className="hm-chips">
                  {chips.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`hm-chip${filter === id ? ' hm-chip--on' : ''}`}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="hm-orders">
                {activeOrders.length === 0 && (
                  <div className="hm-empty">
                    <div className="hm-empty-title">Пока нет активных заказов</div>
                    <div className="hm-empty-sub">Возьмите заказ кнопкой ниже</div>
                  </div>
                )}
                {filtered.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    nowMs={nowMs}
                    currency={currency}
                    onTap={() => openOrderOnMap(o)}
                  />
                ))}
                {activeOrders.length > 0 && filtered.length === 0 && (
                  <div className="hm-filter-empty">Таких заказов сейчас нет</div>
                )}
              </div>
            </section>
          ) : (
            <div className="hm-cta">
              <div className="hm-cta-main">
                <div className="hm-cta-title">Смена не открыта</div>
                <div className="hm-cta-sub">
                  Откройте смену, чтобы принимать заказы
                </div>
              </div>
              <button
                type="button"
                className="hm-cta-btn"
                onClick={() => navigate('/shifts')}
              >
                Открыть
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
