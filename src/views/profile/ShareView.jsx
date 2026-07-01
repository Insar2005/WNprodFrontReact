import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import ImportSharesSection from './ImportSharesSection'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

/**
 * Share screen — just a header + ImportSharesSection (or an empty hint
 * when no workplace is selected). (Was ShareView.vue.)
 */
export default function ShareView() {
  const navigate = useNavigate()
  const currentId = useWorkplaceStore((s) => s.currentId)

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
        <h1 className="sub-title">Поделиться</h1>
      </header>

      {currentId ? (
        <ImportSharesSection />
      ) : (
        <div className="share-empty">
          <p>Сначала выбери заведение в Профиле.</p>
        </div>
      )}
    </div>
  )
}