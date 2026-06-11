import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useOrderStore } from '@/stores/order'
import { formatMoney } from '@/utils/format'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import ActiveOrdersList from './ActiveOrdersList'

/**
 * Home screen. (Was Main.vue.)
 * - computed greeting/todayLabel → plain consts (recomputed per render, cheap).
 * - store getters → selectors; derived arrays via useMemo on raw state.
 * - router.push({name}) → navigate(path).
 */
export default function Main() {
  const navigate = useNavigate()

  const userName = useAuthStore((s) => s.user?.username || '')

  const items = useWorkplaceStore((s) => s.items)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const orders = useOrderStore((s) => s.orders)

  const isEmpty = items.length === 0

  const activeOrders = useMemo(() => orders.filter((o) => !o.is_paid), [orders])
  const activeRevenue = useMemo(
    () => activeOrders.reduce((s, o) => s + (o.total_price || 0), 0),
    [activeOrders],
  )

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5) return 'Доброй ночи'
    if (h < 12) return 'Доброе утро'
    if (h < 17) return 'Добрый день'
    return 'Добрый вечер'
  })()

  const todayLabel = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  // Open the map with this order's details sheet auto-shown.
  const openOrderOnMap = (o) => {
    navigate(`/map?show_order=${encodeURIComponent(o.id)}`)
  }

  return (
    <div className="page">
      <header className="main-header">
        <div className="main-header-left">
          <h1 className="greeting">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </h1>
          <p className="main-date">{todayLabel}</p>
        </div>
        <WorkplaceSwitcher />
      </header>

      {isEmpty ? (
        <section className="empty-block">
          <p className="empty-title">Сначала создайте заведение</p>
          <p className="empty-text">
            Заведение — это место работы. Можно настроить меню, столы,
            начислять смены.
          </p>
          <button className="btn-primary" onClick={() => navigate('/profile')}>
            Перейти в профиль
          </button>
        </section>
      ) : (
        <>
          {!isOpen && (
            <section className="main-section">
              <div className="cta">
                <div className="cta-text">
                  <p className="cta-title">Смена не открыта</p>
                  <p className="cta-sub">Откройте смену, чтобы принимать заказы</p>
                </div>
                <button
                  className="btn-primary btn-primary--small"
                  onClick={() => navigate('/shifts')}
                >
                  Открыть
                </button>
              </div>
            </section>
          )}

          {isOpen && (
            <section className="main-section">
              <div className="section-header">
                <h2 className="main-section-title">
                  Активные заказы
                  {activeOrders.length > 0 && (
                    <span className="section-counter">{activeOrders.length}</span>
                  )}
                </h2>
                <button
                  className="history-btn"
                  onClick={() => navigate('/order-history')}
                >
                  История <span aria-hidden="true">→</span>
                </button>
              </div>
              {activeOrders.length > 0 && (
                <div className="section-subline">
                  На столах: {formatMoney(activeRevenue, currency)}
                </div>
              )}
              <ActiveOrdersList
                orders={activeOrders}
                currency={currency}
                onOpen={openOrderOnMap}
              />
            </section>
          )}
        </>
      )}
    </div>
  )
}