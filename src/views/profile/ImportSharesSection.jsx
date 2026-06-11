import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useImportsStore } from '@/stores/imports'
import { useWorkplaceStore } from '@/stores/workplace'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import ShareCard from './ShareCard'

/**
 * Owner-side share management. (Was ImportSharesSection.vue.)
 * - onMounted(fetchShares) → useEffect keyed on currentId.
 * - activeShares getter → useMemo on raw shares.
 * - TTL prompt is a small inline modal (ttlPromptOpen/ttlHours useState).
 * - copy/share build a deep link: t.me/<bot>?startapp=import_<code>
 *   (matches navMemory.deepLinkImportCode which parses import_<code>).
 */
export default function ImportSharesSection() {
  const navigate = useNavigate()

  const shares = useImportsStore((s) => s.shares)
  const isLoadingShares = useImportsStore((s) => s.isLoadingShares)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const botUsername = useAuthStore((s) => s.botUsername || 'waiternote_bot')

  const [creating, setCreating] = useState(false)
  const [ttlPromptOpen, setTtlPromptOpen] = useState(false)
  const [ttlHours, setTtlHours] = useState(24)

  const activeShares = useMemo(
    () => shares.filter((s) => s.is_active),
    [shares],
  )

  // Load shares when the section mounts / workplace changes.
  useEffect(() => {
    if (!currentId) return
    useImportsStore
      .getState()
      .fetchShares(currentId)
      .catch((e) => {
        useUiStore.getState().toastError(e.message || 'Не удалось загрузить ссылки')
      })
  }, [currentId])

  const ttlValid =
    Number.isFinite(ttlHours) && ttlHours >= 1 && ttlHours <= 168

  const linkFor = (share) =>
    `https://t.me/${botUsername}?startapp=import_${share.code}`

  const onCreateClick = () => {
    setTtlHours(24)
    setTtlPromptOpen(true)
  }

  const confirmCreate = async () => {
    if (!ttlValid || !currentId) return
    setTtlPromptOpen(false)
    setCreating(true)
    try {
      await useImportsStore
        .getState()
        .createShare(currentId, { ttl_hours: ttlHours })
      useUiStore.getState().toastSuccess('Ссылка создана')
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось создать ссылку')
    } finally {
      setCreating(false)
    }
  }

  const copyCode = async (share) => {
    try {
      await navigator.clipboard.writeText(share.code)
      useUiStore.getState().toastSuccess('Код скопирован')
    } catch {
      useUiStore.getState().toastInfo('Не удалось скопировать')
    }
  }

  const copyLink = async (share) => {
    try {
      await navigator.clipboard.writeText(linkFor(share))
      useUiStore.getState().toastSuccess('Ссылка скопирована')
    } catch {
      useUiStore.getState().toastInfo('Не удалось скопировать')
    }
  }

  const shareLink = (share) => {
    const url = linkFor(share)
    const tg = window.Telegram?.WebApp
    const text = 'Скопируй моё меню и залы в Waiter Note'
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      )
    } else {
      copyLink(share)
    }
  }

  const onRevoke = async (share) => {
    const ok = await useUiStore.getState().confirm({
      title: 'Закрыть доступ?',
      message: 'Ссылка перестанет работать. Уже скопированные данные останутся у получателей.',
      confirmText: 'Закрыть',
      danger: true,
    })
    if (!ok) return
    try {
      await useImportsStore.getState().revokeShare(share.id)
      useUiStore.getState().toastSuccess('Доступ закрыт')
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось закрыть')
    }
  }

  const goToImport = () => navigate('/import')

  return (
    <section className="pf-section">
      <h2 className="pf-section-title">Поделиться меню и залами</h2>
      <p className="share-hint">
        Создайте временную ссылку — коллеги смогут скопировать ваше меню и
        расстановку столов в своё заведение.
      </p>

      {activeShares.length > 0 ? (
        <div className="shares-list">
          {activeShares.map((share) => (
            <ShareCard
              key={share.id}
              share={share}
              onCopyCode={copyCode}
              onCopyLink={copyLink}
              onShareLink={shareLink}
              onRevoke={onRevoke}
            />
          ))}
        </div>
      ) : (
        !isLoadingShares && (
          <div className="share-empty">
            <p className="empty-text">Активных ссылок нет.</p>
          </div>
        )
      )}

      <button className="btn-create" disabled={creating} onClick={onCreateClick}>
        {creating ? 'Создаём…' : '+ Создать ссылку'}
      </button>

      <button className="btn-import" onClick={goToImport}>
        ⤓ Импортировать по коду
      </button>

      {ttlPromptOpen && (
        <div
          className="sheet-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTtlPromptOpen(false)
          }}
        >
          <div className="ttl-prompt" role="dialog" aria-modal="true">
            <h3 className="ttl-title">На сколько часов открыть доступ?</h3>
            <p className="ttl-hint">По умолчанию 24 часа. Можно от 1 до 168 (неделя).</p>
            <input
              className="field-input"
              type="number"
              min="1"
              max="168"
              step="1"
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && confirmCreate()}
            />
            <div className="ttl-actions">
              <button className="btn btn--ghost" onClick={() => setTtlPromptOpen(false)}>
                Отмена
              </button>
              <button
                className="btn btn--primary"
                disabled={!ttlValid}
                onClick={confirmCreate}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}