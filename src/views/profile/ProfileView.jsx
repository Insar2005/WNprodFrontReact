import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore, ACCENTS, THEME_OPTIONS } from '@/stores/settings'
import { formatMoney } from '@/utils/format'
import { USE_MOCK } from '@/api/client'
import WorkplaceFormModal from '@/components/WorkplaceFormModal'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

function shiftTypeLabel(t) {
  return t === 'fixed' ? 'фикс' : 'процент'
}

/**
 * Profile hub. (Was ProfileView.vue.) Drills into /profile/* sub-screens.
 * - computed summary strings → useMemo over the relevant raw state.
 * - router.push({name}) → navigate(path).
 * - idRevealed/formVisible → useState.
 */
export default function ProfileView() {
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)

  const items = useWorkplaceStore((s) => s.items)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const current = useMemo(
    () => items.find((w) => w.id === currentId) ?? null,
    [items, currentId],
  )

  const menuItemCount = useMenuStore((s) => s.items.length)
  const halls = useHallStore((s) => s.halls)
  const tables = useHallStore((s) => s.tables)

  const accentKey = useSettingsStore((s) => s.accentKey)
  const theme = useSettingsStore((s) => s.theme)

  const [idRevealed, setIdRevealed] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [editingWorkplace, setEditingWorkplace] = useState(null)

  const tgId = user?.tg_id != null ? String(user.tg_id) : '—'
  const maskedId = tgId !== '—' && tgId.length > 0 ? '•'.repeat(tgId.length) : '—'

  const accentLabel = useMemo(
    () => ACCENTS.find((x) => x.key === accentKey)?.label ?? 'Зелёный',
    [accentKey],
  )
  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((x) => x.key === theme)?.label ?? 'Авто',
    [theme],
  )

  const hallSummary = useMemo(() => {
    const h = halls?.length ?? 0
    const t = tables?.length ?? 0
    if (h === 0) return 'нет залов'
    return `${h} ${pluralize(h, ['зал', 'зала', 'залов'])}, ${t} ${pluralize(t, ['стол', 'стола', 'столов'])}`
  }, [halls, tables])

  const workplacesSummary = useMemo(() => {
    const active = items.filter((w) => !w.is_archived).length
    const archived = items.filter((w) => w.is_archived).length
    if (active === 0 && archived === 0) return 'пусто'
    const parts = [
      `${active} ${pluralize(active, ['активное', 'активных', 'активных'])}`,
    ]
    if (archived > 0) parts.push(`+ ${archived} в архиве`)
    return parts.join(' ')
  }, [items])

  const copyId = async () => {
    if (!tgId || tgId === '—') return
    try {
      await navigator.clipboard.writeText(tgId)
      useUiStore.getState().toastSuccess('ID скопирован')
    } catch {
      setIdRevealed(true)
      useUiStore
        .getState()
        .toastInfo('Не удалось скопировать — ID показан, скопируйте вручную')
    }
  }

  const openEditCurrentWorkplace = () => {
    if (!current) return
    if (current.my_role !== 'owner') {
      useUiStore.getState().toastInfo('Редактировать заведение может только владелец')
      return
    }
    setEditingWorkplace(current)
    setFormVisible(true)
  }

  const closeForm = () => {
    setFormVisible(false)
    setEditingWorkplace(null)
  }

  return (
    <div className="page">
      <header className="pf-header">
        <div className="pf-header-row">
          <div className="pf-header-main">
            <h1 className="pf-title">Профиль</h1>
            <p className="pf-subtitle">@{user?.username || 'без имени'}</p>
          </div>
        </div>

        <div className="tg-id-row">
          <div className="tg-id-info">
            <span className="tg-id-label">Telegram ID</span>
            <span className="tg-id-value">{idRevealed ? tgId : maskedId}</span>
          </div>
          <div className="tg-id-actions">
            <button
              className="tg-id-btn"
              aria-label={idRevealed ? 'Скрыть' : 'Показать'}
              onClick={() => setIdRevealed((v) => !v)}
            >
              {idRevealed ? '🙈' : '👁️'}
            </button>
            <button className="tg-id-btn" aria-label="Скопировать" onClick={copyId}>
              📋
            </button>
          </div>
        </div>
      </header>

      {current && (
        <section className="pf-section">
          <h2 className="pf-section-title">Текущее заведение</h2>
          <div
            className="card card--current"
            role="button"
            tabIndex={0}
            onClick={openEditCurrentWorkplace}
            onKeyDown={(e) => e.key === 'Enter' && openEditCurrentWorkplace()}
          >
            <div className="card-main">
              <div className="card-title-row">
                <span className="card-title">{current.title}</span>
                {current.my_role !== 'owner' && (
                  <span className="card-badge card-badge--muted">участник</span>
                )}
              </div>
              <div className="card-meta">
                {current.currency} · {shiftTypeLabel(current.shift_type_default)}
                {current.shift_type_default === 'fixed'
                  ? ` · ${formatMoney(current.pay_for_shift_default, current.currency)}/смена`
                  : ` · ${current.service_percent_default}%`}
              </div>
            </div>
            <span className="card-chev">›</span>
          </div>
        </section>
      )}

      <section className="pf-section">
        <h2 className="pf-section-title">Настройки</h2>
        <div className="pf-list">
          <button className="action-row" onClick={() => navigate('/profile/appearance')}>
            <span className="action-icon">🎨</span>
            <span className="action-text">
              <span className="action-name">Персонализация</span>
              <span className="action-meta">
                {accentLabel} · {themeLabel}
              </span>
            </span>
            <span className="action-chev">›</span>
          </button>

          {current && (
            <button className="action-row" onClick={() => navigate('/menu')}>
              <span className="action-icon">🍽️</span>
              <span className="action-text">
                <span className="action-name">Меню</span>
                <span className="action-meta">{menuItemCount} позиций</span>
              </span>
              <span className="action-chev">›</span>
            </button>
          )}

          {current && (
            <button className="action-row" onClick={() => navigate('/hall-editor')}>
              <span className="action-icon">🪑</span>
              <span className="action-text">
                <span className="action-name">Карта столов</span>
                <span className="action-meta">{hallSummary}</span>
              </span>
              <span className="action-chev">›</span>
            </button>
          )}

          {current && (
            <button className="action-row" onClick={() => navigate('/profile/share')}>
              <span className="action-icon">🔗</span>
              <span className="action-text">
                <span className="action-name">Поделиться меню и залами</span>
                <span className="action-meta">Создать ссылку или импортировать</span>
              </span>
              <span className="action-chev">›</span>
            </button>
          )}

          <button className="action-row" onClick={() => navigate('/profile/workplaces')}>
            <span className="action-icon">🏢</span>
            <span className="action-text">
              <span className="action-name">Все заведения</span>
              <span className="action-meta">{workplacesSummary}</span>
            </span>
            <span className="action-chev">›</span>
          </button>

          {USE_MOCK && (
            <button className="action-row" onClick={() => navigate('/profile/dev')}>
              <span className="action-icon">🛠</span>
              <span className="action-text">
                <span className="action-name">Dev tools</span>
                <span className="action-meta">mock-режим</span>
              </span>
              <span className="action-chev">›</span>
            </button>
          )}
        </div>
      </section>

      {formVisible && (
        <WorkplaceFormModal
          initial={editingWorkplace}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}