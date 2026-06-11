import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'

/**
 * Bot-access gate. Two states share the screen:
 *   - 'blocked'     — user hasn't pressed /start; show "open the bot".
 *   - 'unreachable' — couldn't reach Telegram; show a plain retry.
 *
 * recheck() deliberately does NOT navigate. App.jsx has an effect watching
 * auth.botStatus; when it flips to 'ok' that effect re-runs boot(), which
 * loads data and routes correctly. Navigating here would land on an empty
 * /home because the early-returned boot() never loaded anything.
 */
export default function BotRequiredView() {
  const status = useAuthStore((s) => s.botStatus)
  const botUsername = useAuthStore((s) => s.botUsername)
  const [busy, setBusy] = useState(false)

  const openBot = () => {
    const name = botUsername || 'waiternote_bot'
    const url = `https://t.me/${name}`
    const tg = window.Telegram?.WebApp
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const recheck = async () => {
    if (busy) return
    setBusy(true)
    try {
      await useAuthStore.getState().checkBotAccess()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-icon">🤖</div>

        {status === 'blocked' ? (
          <>
            <h1 className="gate-title">Разреши боту писать тебе</h1>
            <p className="gate-text">
              Открой бота <strong>@{botUsername || 'waiternote_bot'}</strong> и
              нажми <strong>Start</strong> — это нужно, чтобы мы могли отправлять
              тебе уведомления.
            </p>
            <button className="gate-btn-primary" onClick={openBot}>
              Открыть бота
            </button>
            <button className="gate-btn-secondary" disabled={busy} onClick={recheck}>
              {busy ? 'Проверяем…' : 'Готово, проверить'}
            </button>
          </>
        ) : (
          <>
            <h1 className="gate-title">Не получилось связаться с Telegram</h1>
            <p className="gate-text">Проверь интернет и попробуй ещё раз.</p>
            <button className="gate-btn-primary" disabled={busy} onClick={recheck}>
              {busy ? 'Проверяем…' : 'Попробовать снова'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}