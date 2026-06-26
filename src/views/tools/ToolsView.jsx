import { useNavigate } from 'react-router-dom'
import '@/styles/tools.css'

/**
 * Tools landing screen ("Инструменты"). Each tool is its own larger card
 * (separated, not merged into one list block) with a tinted icon.
 */

const ICON_PROPS = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

function IconNote(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  )
}

function IconBell(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <path d="M6 17V11a6 6 0 0 1 12 0v6" />
      <path d="M4.5 17h15" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

function IconCalc(props) {
  return (
    <svg {...ICON_PROPS} {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx="0.7" />
      <path d="M9 13h.01M12.5 13h.01M16 13h.01M9 16.5h.01M12.5 16.5h.01M16 16.5h.01" />
    </svg>
  )
}

function IconChevron(props) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

const TOOLS = [
  { key: 'notes', title: 'Заметки', meta: 'Заметки по работе и сменам', to: '/notes', tint: 'sky', Icon: IconNote },
  { key: 'reminders', title: 'Напоминания', meta: 'Напоминание о делах и задачах', to: '/reminders', tint: 'peach', Icon: IconBell },
  { key: 'calc', title: 'Калькулятор', meta: 'Быстрые расчёты', to: '/calculator', tint: 'lavender', Icon: IconCalc },
]

export default function ToolsView() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <header className="pf-header">
        <h1 className="pf-title">Инструменты</h1>
      </header>

      <div className="tool-list">
        {TOOLS.map((t) => (
          <button key={t.key} className="tool-card" onClick={() => navigate(t.to)}>
            <span className={`tool-card-icon tool-card-icon--${t.tint}`}>
              <t.Icon />
            </span>
            <span className="tool-card-body">
              <span className="tool-card-title">{t.title}</span>
              <span className="tool-card-meta">{t.meta}</span>
            </span>
            <span className="tool-card-chev">
              <IconChevron />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
