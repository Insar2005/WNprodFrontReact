import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { useSettingsStore, ACCENTS, THEME_OPTIONS } from '@/stores/settings'
import { getUser as getTgUser } from '@/utils/telegram'
import { USE_MOCK } from '@/api/client'
import WorkplaceFormModal from '@/components/WorkplaceFormModal'
import {
  IconStore,
  IconTable,
  IconMenu,
  IconBell,
  IconLogout,
  IconShare,
  IconBuilding,
  IconTools,
  IconChevron,
  IconCheck,
} from './icons'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/* ---------- Hero helpers ---------- */

/**
 * Backend's /me only persists `username` (and `tg_id`); first/last name
 * and photo come from `window.Telegram.WebApp.initDataUnsafe.user`,
 * which we read once at mount and pass into the helpers below as `tgUser`.
 *
 * Field priority for display name:
 *   1. first_name + last_name (the most natural display)
 *   2. first_name only
 *   3. @username
 *   4. id<tg_id>
 *   5. "Пользователь" (final fallback)
 */
function displayName(user, tgUser) {
  const first = tgUser?.first_name?.trim() || user?.first_name?.trim()
  const last = tgUser?.last_name?.trim() || user?.last_name?.trim()
  if (first && last) return `${first} ${last}`
  if (first) return first
  const uname = tgUser?.username || user?.username
  if (uname) return `@${uname}`
  if (user?.tg_id != null) return `id${user.tg_id}`
  return 'Пользователь'
}

/**
 * Avatar initial — used when there's no `photo_url` from Telegram, or
 * when the photo fails to load (CORS / network). Same priority as name.
 */
function avatarInitial(user, tgUser) {
  const first = tgUser?.first_name?.trim() || user?.first_name?.trim()
  if (first) return first[0].toUpperCase()
  const uname = tgUser?.username || user?.username
  if (uname) return uname[0].toUpperCase()
  const id = user?.tg_id != null ? String(user.tg_id) : ''
  if (id) return id[0]
  return '?'
}

/* ---------- Reusable card row ---------- */

function PfRow({ icon, title, meta, danger = false, chevron = true, onClick }) {
  const cls = danger ? 'pf-row pf-row--danger' : 'pf-row'
  return (
    <button type="button" className={cls} onClick={onClick}>
      <span className="pf-row-icon">{icon}</span>
      <span className="pf-row-body">
        <span className="pf-row-title">{title}</span>
        {meta && <span className="pf-row-meta">{meta}</span>}
      </span>
      {chevron && !danger && (
        <span className="pf-row-chev">
          <IconChevron />
        </span>
      )}
    </button>
  )
}

/* ---------- Main view ---------- */

export default function ProfileView() {
  const navigate = useNavigate()

  const user = useAuthStore((s) => s.user)

  // Telegram-only fields (first_name, last_name, photo_url). Read once
  // at mount — Telegram doesn't re-emit user data, so a single read is
  // sufficient. Wrapped in state so a re-render after late hydration
  // works if you ever change the call site.
  const [tgUser] = useState(() => getTgUser())

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

  const [usernameRevealed, setUsernameRevealed] = useState(false)
  const [formVisible, setFormVisible] = useState(false)
  const [editingWorkplace, setEditingWorkplace] = useState(null)

  // === Username (preferred handle) ===
  const username = tgUser?.username || user?.username || ''
  const hasUsername = !!username
  const usernameMasked = username ? '•'.repeat(Math.min(username.length, 12)) : ''

  // === Photo (Telegram WebApp.user.photo_url is a CDN URL, no auth) ===
  // Some Telegram desktop builds omit photo_url; some users have no photo.
  // Either way → fall back to the initial letter on the colored circle.
  const photoUrl = tgUser?.photo_url || null

  // Reset photoFailed when the URL itself changes — without using an
  // effect (the react-hooks plugin v7 flags setState-in-effect).
  // Track the URL the failed flag refers to; if it diverges from the
  // current URL, force-reset the flag inline during render.
  const [photoFailedFor, setPhotoFailedFor] = useState(null)
  const photoFailed = photoFailedFor === photoUrl && photoUrl !== null
  const showPhoto = !!photoUrl && !photoFailed

  // === Summaries ===
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

  const menuMeta = `${menuItemCount} ${pluralize(menuItemCount, ['позиция', 'позиции', 'позиций'])}`

  // === Actions ===

  const copyUsername = async () => {
    if (!username) return
    try {
      await navigator.clipboard.writeText('@' + username)
      useUiStore.getState().toastSuccess('Скопировано')
    } catch {
      setUsernameRevealed(true)
      useUiStore
        .getState()
        .toastInfo('Не удалось скопировать — скопируйте вручную')
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

  /**
   * "Logout" inside a Telegram Mini App: auth is bound to initData, no
   * separate session to drop. Confirm + close the WebApp; to switch
   * accounts the user re-opens the bot.
   */
  const onLogout = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Закрыть приложение?',
      message:
        'Чтобы переключить аккаунт, выйдите из бота в Telegram и зайдите заново.',
      confirmText: 'Понятно',
      cancelText: 'Отмена',
    })
    if (!ok) return
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
    if (tg?.close) tg.close()
  }

  const name = displayName(user, tgUser)
  const initial = avatarInitial(user, tgUser)

  return (
    <div className="page">
      {/* ── HERO ── */}
      <header className="pf-header">
        <h1 className="pf-title">Профиль</h1>

        <div className="pf-hero">
          <div className="pf-avatar" aria-hidden="true">
            {showPhoto ? (
              <img
                className="pf-avatar-img"
                src={photoUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setPhotoFailedFor(photoUrl)}
              />
            ) : (
              initial
            )}
          </div>
          <div className="pf-hero-text">
            <div className="pf-hero-name">{name}</div>
            <div className="pf-hero-handle-row">
              {hasUsername ? (
                <>
                  <span className="pf-hero-handle">
                    {usernameRevealed ? `@${username}` : usernameMasked}
                  </span>
                  <button
                    className="pf-hero-icon-btn"
                    aria-label={usernameRevealed ? 'Скрыть' : 'Показать'}
                    onClick={() => setUsernameRevealed((v) => !v)}
                  >
                    {usernameRevealed ? '🙈' : '👁️'}
                  </button>
                  <button
                    className="pf-hero-icon-btn"
                    aria-label="Скопировать"
                    onClick={copyUsername}
                  >
                    📋
                  </button>
                </>
              ) : user?.tg_id != null ? (
                <span className="pf-hero-handle pf-hero-handle--mono">
                  id{user.tg_id}
                </span>
              ) : (
                <span className="pf-hero-handle pf-hero-handle--muted">
                  без имени
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── ЗАВЕДЕНИЕ ── */}
      <div className="pf-section-label">Заведение</div>
      <div className="pf-card-group">
        {current ? (
          <PfRow
            icon={<IconStore />}
            title={current.title}
            meta="Редактировать"
            onClick={openEditCurrentWorkplace}
          />
        ) : (
          <PfRow
            icon={<IconBuilding />}
            title="Заведения"
            meta={workplacesSummary}
            onClick={() => navigate('/profile/workplaces')}
          />
        )}

        {current && (
          <>
            <div className="pf-card-divider" />
            <PfRow
              icon={<IconTable />}
              title="Залы и столы"
              meta={hallSummary}
              onClick={() => navigate('/hall-editor')}
            />
            <div className="pf-card-divider" />
            <PfRow
              icon={<IconMenu />}
              title="Меню"
              meta={menuMeta}
              onClick={() => navigate('/menu')}
            />
          </>
        )}
      </div>

      {/* ── ПЕРСОНАЛИЗАЦИЯ ── */}
      <div className="pf-section-label">Персонализация</div>
      <div className="perso-card">
        <div className="perso-block">
          <span className="perso-label">Цвет акцента</span>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                className={
                  accentKey === a.key ? 'swatch swatch--active' : 'swatch'
                }
                style={{ '--sw': a.accent }}
                aria-label={a.label}
                aria-pressed={accentKey === a.key}
                onClick={() => useSettingsStore.getState().setAccent(a.key)}
              >
                {accentKey === a.key && <IconCheck />}
              </button>
            ))}
          </div>
        </div>

        <div className="perso-divider" />

        <div className="perso-block">
          <span className="perso-label">Тема</span>
          <div className="seg">
            {THEME_OPTIONS.map((t) => (
              <button
                key={t.key}
                className={theme === t.key ? 'seg-btn seg-btn--on' : 'seg-btn'}
                onClick={() => useSettingsStore.getState().setTheme(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="perso-hint">«Авто» подстраивается под тему Telegram.</p>
        </div>
      </div>

      {/* ── ДОПОЛНИТЕЛЬНО ── */}
      {(current || USE_MOCK) && (
        <div className="pf-card-group pf-card-group--spaced">
          {current && (
            <PfRow
              icon={<IconShare />}
              title="Поделиться меню и залами"
              meta="Создать ссылку или импортировать"
              onClick={() => navigate('/profile/share')}
            />
          )}
          {current && <div className="pf-card-divider" />}
          <PfRow
            icon={<IconBuilding />}
            title="Все заведения"
            meta={workplacesSummary}
            onClick={() => navigate('/profile/workplaces')}
          />
          {USE_MOCK && (
            <>
              <div className="pf-card-divider" />
              <PfRow
                icon={<IconTools />}
                title="Dev tools"
                meta="mock-режим"
                onClick={() => navigate('/profile/dev')}
              />
            </>
          )}
        </div>
      )}

      {/* ── УВЕДОМЛЕНИЯ + ВЫЙТИ ── */}
      <div className="pf-card-group pf-card-group--spaced">
        <PfRow
          icon={<IconBell />}
          title="Уведомления"
          onClick={() =>
            useUiStore.getState().toastInfo('Скоро добавим — настройки в боте')
          }
        />
        <div className="pf-card-divider" />
        <PfRow
          icon={<IconLogout />}
          title="Выйти"
          danger
          chevron={false}
          onClick={onLogout}
        />
      </div>

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