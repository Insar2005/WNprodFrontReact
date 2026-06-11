import { useNow } from '@/hooks/useNow'

/**
 * One active import-share. Live "time left" countdown ticks each minute.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - onMounted/onUnmounted that set up a 60s interval to refresh the
 *   countdown → our useNow(60_000) hook; timeLeft derived from it.
 * - $emit(...) → callback props (onCopyCode, onCopyLink, onShareLink, onRevoke).
 * ─────────────────────────────────────────────────────────────────────
 */

function formatTimeLeft(expiresAt, nowMs) {
  const secondsLeft = expiresAt - Math.floor(nowMs / 1000)
  if (secondsLeft <= 0) return 'истёк'
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  if (h >= 24) {
    const d = Math.floor(h / 24)
    return `${d} дн ${h % 24} ч`
  }
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

export default function ShareCard({
  share,
  onCopyCode,
  onCopyLink,
  onShareLink,
  onRevoke,
}) {
  const now = useNow(60_000)
  const timeLeft = formatTimeLeft(share.expires_at, now.getTime())

  return (
    <div className="share-card">
      <div className="share-top">
        <code className="share-code" onClick={() => onCopyCode?.(share)}>
          {share.code}
        </code>
        <button
          className="icon-btn icon-btn--danger"
          title="Закрыть"
          onClick={() => onRevoke?.(share)}
        >
          ✕
        </button>
      </div>

      <div className="share-meta">
        <span className="share-meta-line">⏰ {timeLeft}</span>
        <span className="share-meta-line">👤 импортов: {share.import_count}</span>
      </div>

      <div className="share-actions">
        <button className="share-btn" onClick={() => onCopyCode?.(share)}>
          📋 Код
        </button>
        <button className="share-btn" onClick={() => onCopyLink?.(share)}>
          🔗 Ссылка
        </button>
        <button
          className="share-btn share-btn--primary"
          onClick={() => onShareLink?.(share)}
        >
          📤 Поделиться
        </button>
      </div>
    </div>
  )
}