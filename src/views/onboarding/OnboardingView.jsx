import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import { TIMEZONES, formatTimezoneOption } from '@/utils/timezones'
import '@/styles/onboarding.css'

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
  const [shiftType, setShiftType] = useState('') // '' | 'fixed' | 'percent'
  const [pay, setPay] = useState('')
  const [percent, setPercent] = useState('')

  const next = () => setStep((s) => Math.min(2, s + 1))
  const prev = () => setStep((s) => Math.max(0, s - 1))

  // All workplace fields are required before finishing.
  const amountOk =
    shiftType === 'fixed'
      ? Number(pay) > 0
      : shiftType === 'percent'
        ? Number(percent) > 0
        : false
  const canFinish = !!title.trim() && amountOk

  const finish = async () => {
    if (busy || !canFinish) return
    const trimmed = title.trim()
    setBusy(true)
    try {
      await useWorkplaceStore.getState().create({
        id: newId(),
        title: trimmed,
        currency,
        timezone,
        shift_type_default: shiftType,
        service_percent_default: shiftType === 'percent' ? Number(percent) : 0,
        pay_for_shift_default: shiftType === 'fixed' ? Number(pay) : 0,
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
        <section className="ob-step ob-welcome">
          <div className="ob-hero">
            <div className="ob-badge" aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 3h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V4.5A1.5 1.5 0 0 1 7 3Z" />
                <path d="M14 3v4h4" />
                <path d="M9 13.5l2 2 4-4.5" />
              </svg>
            </div>
            <h1 className="ob-hero-title">Waiter Note</h1>
            <p className="ob-hero-sub">Помощник официанта прямо в Telegram</p>
          </div>

          <p className="ob-lead">
            Заказы, столы, смены и чаевые — всё в одном месте. Никаких
            забытых заказов и подсчётов в уме: приложение ведёт смену вместе
            с вами.
          </p>

          <ul className="ob-pills">
            <li>📋 Заказы</li>
            <li>⏱ Смены</li>
            <li>🪑 Зал</li>
            <li>🛠 Инструменты</li>
          </ul>

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
              <span className="feature-icon">🛠</span>
              <div className="feature-body">
                <div className="feature-name">Инструменты</div>
                <div className="feature-desc">
                  Всё, что нужно на смене: заметки, напоминания, калькулятор и др.
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

            <fieldset className="fm-fieldset">
              <legend className="fm-legend">Оплата за смену</legend>
              <div className="fm-radio-row">
                <label className="fm-radio">
                  <input
                    type="radio"
                    name="ob_shift_type"
                    value="fixed"
                    checked={shiftType === 'fixed'}
                    onChange={() => setShiftType('fixed')}
                  />
                  <span>Ставка</span>
                </label>
                <label className="fm-radio">
                  <input
                    type="radio"
                    name="ob_shift_type"
                    value="percent"
                    checked={shiftType === 'percent'}
                    onChange={() => setShiftType('percent')}
                  />
                  <span>Процент с продаж</span>
                </label>
              </div>
            </fieldset>

            {shiftType === 'fixed' && (
              <label className="field">
                <span className="field-label">Ставка за смену ({currency})</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="100"
                  inputMode="numeric"
                  placeholder="Например: 2000"
                  value={pay}
                  onChange={(e) => setPay(e.target.value)}
                />
              </label>
            )}
            {shiftType === 'percent' && (
              <label className="field">
                <span className="field-label">Процент с продаж (0–100)</span>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  placeholder="Например: 5"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
              </label>
            )}
            {!shiftType && (
              <p className="ob-hint">Выберите тип оплаты, чтобы продолжить.</p>
            )}
          </div>

          <div className="step-actions">
            <button className="ob-btn ob-btn--ghost" disabled={busy} onClick={prev}>
              Назад
            </button>
            <button
              className="ob-btn ob-btn--primary"
              disabled={busy || !canFinish}
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
