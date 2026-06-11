import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import { TIMEZONES, formatTimezoneOption } from '@/utils/timezones'

/**
 * 3-step onboarding: welcome → features → create first workplace.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - step/busy/form fields were Vue refs → useState.
 * - v-model on inputs/selects → controlled (value + onChange).
 * - finish() creates the workplace, marks onboarding complete, navigates
 *   to /home. Same logic as the Vue version.
 * - detectTimezone() runs once to seed the select (lazy useState init).
 * ─────────────────────────────────────────────────────────────────────
 */

function detectTimezone() {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserTz && TIMEZONES.some((t) => t.id === browserTz)) return browserTz
    const offset = -new Date().getTimezoneOffset()
    const match = TIMEZONES.find((t) => t.offsetMin === offset)
    if (match) return match.id
  } catch {
    /* fallthrough */
  }
  return 'Europe/Moscow'
}

export default function OnboardingView() {
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState('')
  const [currency, setCurrency] = useState('RUB')
  const [timezone, setTimezone] = useState(() => detectTimezone())

  const next = () => setStep((s) => Math.min(2, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))

  const finish = async () => {
    const trimmed = title.trim()
    if (busy || !trimmed) return
    setBusy(true)
    try {
      await useWorkplaceStore.getState().create({
        id: newId(),
        title: trimmed,
        currency,
        timezone,
        // Backend's WorkplaceCreate requires pay/shift fields; onboarding
        // keeps the form minimal, so send sensible defaults — tuned later.
        service_percent_default: 0,
        shift_type_default: 'fixed',
        pay_for_shift_default: 0,
      })
      await useAuthStore.getState().completeOnboarding()
      navigate('/home', { replace: true })
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось создать заведение')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="dots">
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            className={n === step ? 'dot dot--active' : 'dot'}
          />
        ))}
      </div>

      {step === 0 && (
        <section className="ob-step">
          <div className="hero">
            <div className="hero-icon">📝</div>
            <h1 className="hero-title">Waiter Note</h1>
            <p className="hero-subtitle">Ваш блокнот официанта</p>
          </div>
          <p className="step-text">
            Заказы по столам, учёт смен и чаевых, карта зала — всё в одном
            месте, прямо в Telegram.
          </p>
          <div className="step-actions">
            <button className="ob-btn ob-btn--primary" onClick={next}>
              Начать
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="ob-step">
          <h2 className="step-title">Что вы получите</h2>
          <ul className="features">
            <li className="feature">
              <span className="feature-icon">📋</span>
              <div className="feature-body">
                <div className="feature-name">Заказы по столам</div>
                <div className="feature-desc">
                  Принимайте и ведите заказы, отмечайте поданные блюда
                </div>
              </div>
            </li>
            <li className="feature">
              <span className="feature-icon">⏱️</span>
              <div className="feature-body">
                <div className="feature-name">Смены и зарплата</div>
                <div className="feature-desc">
                  Учёт смен, чаевых и заработка автоматически
                </div>
              </div>
            </li>
            <li className="feature">
              <span className="feature-icon">🪑</span>
              <div className="feature-body">
                <div className="feature-name">Карта зала</div>
                <div className="feature-desc">
                  Расставьте столы и видьте их статус в реальном времени
                </div>
              </div>
            </li>
            <li className="feature">
              <span className="feature-icon">📝</span>
              <div className="feature-body">
                <div className="feature-name">Заметки</div>
                <div className="feature-desc">
                  Заметки по смене, заведению или общие
                </div>
              </div>
            </li>
          </ul>
          <div className="step-actions">
            <button className="ob-btn ob-btn--ghost" onClick={prev}>
              Назад
            </button>
            <button className="ob-btn ob-btn--primary" onClick={next}>
              Дальше
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="ob-step">
          <h2 className="step-title">Ваше место работы</h2>
          <p className="step-text">
            Добавьте заведение, где вы работаете. Настройки оплаты и смен
            можно будет изменить позже.
          </p>

          <div className="ob-form">
            <label className="field">
              <span className="field-label">Название заведения</span>
              <input
                className="field-input"
                type="text"
                placeholder="Например: Кафе «Уют»"
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field-label">Валюта</span>
              <select
                className="field-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="RUB">RUB — рубль</option>
                <option value="USD">USD — доллар</option>
                <option value="EUR">EUR — евро</option>
                <option value="KZT">KZT — тенге</option>
                <option value="KGS">KGS — сом</option>
                <option value="UAH">UAH — гривна</option>
              </select>
            </label>

            <label className="field">
              <span className="field-label">Часовой пояс</span>
              <select
                className="field-input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {formatTimezoneOption(tz)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="step-actions">
            <button className="ob-btn ob-btn--ghost" disabled={busy} onClick={prev}>
              Назад
            </button>
            <button
              className="ob-btn ob-btn--primary"
              disabled={busy || !title.trim()}
              onClick={finish}
            >
              {busy ? 'Создаём…' : 'Создать и начать'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}