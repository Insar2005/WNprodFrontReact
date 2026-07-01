import { useNavigate } from 'react-router-dom'
import { useSettingsStore, ACCENTS, THEME_OPTIONS } from '@/stores/settings'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'
/**
 * Appearance settings. (Was AppearanceView.vue.)
 * - settings.accentKey/theme read via SELECTORS so the active swatch /
 *   segment updates immediately on tap.
 * - setAccent/setTheme called via getState() (they apply the theme to the
 *   DOM live and sync to the server — see settings store).
 * - goBack: router.back() if there's history, else navigate('/profile')
 *   (back is a no-op on a fresh/deep-linked load).
 */
export default function AppearanceView() {
  const navigate = useNavigate()
  const accentKey = useSettingsStore((s) => s.accentKey)
  const theme = useSettingsStore((s) => s.theme)

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/profile')
  }
  useTelegramBackButton(goBack)

  return (
    <div className="page">
      <header className="sub-header">
        {/* <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button> */}
        <h1 className="sub-title">Персонализация</h1>
      </header>

      <section className="pf-section">
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
                  {accentKey === a.key && (
                    <svg
                      className="swatch-check"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  )}
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
      </section>
    </div>
  )
}