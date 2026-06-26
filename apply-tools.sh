#!/usr/bin/env bash
# Инструменты + напоминания + онбординг + заказ (гости, перенос, чаевые, итоги) для WNprodFrontReact.
# Запуск из КОРНЯ проекта (где package.json):  bash apply-tools.sh
set -e
if [ ! -f package.json ]; then echo "ОШИБКА: запусти из корня проекта (там, где package.json)"; exit 1; fi
echo "Создаю/обновляю файлы..."
mkdir -p src/views/tools src/styles src/components src/router src/views/notes src/views/onboarding src/views/order src/api src/stores src/mocks

# ---- src/views/tools/ToolsView.jsx ----
cat > "src/views/tools/ToolsView.jsx" <<'WN_TOOLS_EOF'
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
WN_TOOLS_EOF

# ---- src/views/tools/RemindersView.jsx ----
cat > "src/views/tools/RemindersView.jsx" <<'WN_TOOLS_EOF'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRemindersStore, leadLabel } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'
import ReminderFormModal from './ReminderFormModal'
import '@/styles/reminders.css'

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const GROUP_META = {
  overdue: { title: 'Просрочено', danger: true },
  today: { title: 'Сегодня' },
  tomorrow: { title: 'Завтра' },
  later: { title: 'Позже' },
  done: { title: 'Выполнено' },
}
const GROUP_ORDER = ['overdue', 'today', 'tomorrow', 'later', 'done']

function IconBack(props) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

/** Time label for a list item — time only for today/tomorrow, else date+time. */
function listLabel(r, groupKey) {
  const d = new Date(r.remind_at * 1000)
  const t = timeFmt.format(d)
  if (groupKey === 'today' || groupKey === 'tomorrow') return t
  return `${dateFmt.format(d)}, ${t}`
}

function ReminderRow({ r, label, anim, onToggle, onOpen, onDelete }) {
  const cls = ['rm-item']
  if (r.is_done) cls.push('rm-item--done')
  if (anim === 'leaving') cls.push('rm-leaving')
  if (anim === 'entering') cls.push('rm-entering')
  return (
    <div className={cls.join(' ')}>
      <button
        className={r.is_done ? 'rm-check rm-check--on' : 'rm-check'}
        onClick={() => onToggle(r)}
        aria-label={r.is_done ? 'Снять отметку' : 'Выполнено'}
      >
        {r.is_done && '✓'}
      </button>
      <span className="rm-item-sep" aria-hidden="true" />
      <button className="rm-item-body" onClick={() => onOpen(r)}>
        <span className="rm-item-text">{r.text}</span>
        <span className="rm-item-time">
          {label}
          {r.lead_minutes > 0 && <span className="rm-lead"> · {leadLabel(r.lead_minutes).toLowerCase()}</span>}
        </span>
      </button>
      {r.is_done && (
        <button className="rm-delete" onClick={() => onDelete(r)}>
          Удалить
        </button>
      )}
    </div>
  )
}

export default function RemindersView() {
  const navigate = useNavigate()
  const items = useRemindersStore((s) => s.items)
  const isLoading = useRemindersStore((s) => s.isLoading)
  const loaded = useRemindersStore((s) => s.loaded)
  const toggleDone = useRemindersStore((s) => s.toggleDone)

  const [tab, setTab] = useState('list')
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(() => startOfDay(new Date()))
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [leavingId, setLeavingId] = useState(null)
  const [enteringId, setEnteringId] = useState(null)

  // Toggle done with a little "fly down to Выполнено" animation: play the
  // exit animation first, then reorder, then a fade-in at the new spot.
  const handleToggle = (r) => {
    if (r.is_done) {
      toggleDone(r.id)
      return
    }
    setLeavingId(r.id)
    setTimeout(() => {
      toggleDone(r.id)
      setLeavingId(null)
      setEnteringId(r.id)
      setTimeout(() => setEnteringId(null), 420)
    }, 280)
  }
  const animOf = (id) => (id === leavingId ? 'leaving' : id === enteringId ? 'entering' : null)

  // Delete a completed reminder (with confirmation).
  const handleDelete = async (r) => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить напоминание?',
      message: `«${r.text}» будет удалено. Это действие нельзя отменить.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (!ok) return
    try {
      await useRemindersStore.getState().remove(r.id)
    } catch (e) {
      ui.toastError(e.message || 'Не удалось удалить')
    }
  }

  // Load on first mount (notes use boot(); reminders load themselves).
  useEffect(() => {
    if (!loaded) useRemindersStore.getState().fetchAll().catch(() => {})
  }, [loaded])

  // Grouping depends on the current time, so it's computed on each render
  // (cheap for a few dozen items) rather than memoized.
  const groups = (() => {
    const now = new Date().getTime()
    const t1 = startOfDay(new Date()).getTime() + 86400000
    const t2 = t1 + 86400000
    const b = { overdue: [], today: [], tomorrow: [], later: [], done: [] }
    for (const r of [...items].sort((a, x) => a.remind_at - x.remind_at)) {
      if (r.is_done) { b.done.push(r); continue }
      const ms = r.remind_at * 1000
      if (ms < now) b.overdue.push(r)
      else if (ms < t1) b.today.push(r)
      else if (ms < t2) b.tomorrow.push(r)
      else b.later.push(r)
    }
    return b
  })()

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (r) => { setEditing(r); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  // ── Calendar ──
  const year = monthCursor.getFullYear()
  const month = monthCursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWd = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
  const today = new Date()

  const daysWithReminders = useMemo(() => {
    const y = monthCursor.getFullYear()
    const m = monthCursor.getMonth()
    const set = new Set()
    for (const r of items) {
      const d = new Date(r.remind_at * 1000)
      if (d.getFullYear() === y && d.getMonth() === m) set.add(d.getDate())
    }
    return set
  }, [items, monthCursor])

  const selectedItems = useMemo(
    () =>
      [...items]
        .filter((r) => sameDay(new Date(r.remind_at * 1000), selected))
        .sort((a, b) => a.remind_at - b.remind_at),
    [items, selected],
  )

  const hasAny = items.length > 0

  return (
    <div className="page">
      <header className="sub-header">
        <button className="back-btn" onClick={() => navigate('/tools')} aria-label="Назад">
          <IconBack />
        </button>
        <h1 className="sub-title">Напоминания</h1>
      </header>

      <div className="seg rm-seg">
        <button className={tab === 'list' ? 'seg-btn seg-btn--on' : 'seg-btn'} onClick={() => setTab('list')}>
          Список
        </button>
        <button className={tab === 'calendar' ? 'seg-btn seg-btn--on' : 'seg-btn'} onClick={() => setTab('calendar')}>
          Календарь
        </button>
      </div>

      {tab === 'list' ? (
        isLoading && !hasAny ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !hasAny ? (
          <div className="rm-card"><p className="rm-empty">Напоминаний пока нет. Нажмите «+», чтобы добавить.</p></div>
        ) : (
          <div className="rm-list">
            {GROUP_ORDER.filter((k) => groups[k].length).map((k) => (
              <section className="rm-group" key={k}>
                <h2 className={GROUP_META[k].danger ? 'rm-group-title rm-group-title--danger' : 'rm-group-title'}>
                  {GROUP_META[k].title}
                </h2>
                <div className="rm-card">
                  {groups[k].map((r, i) => (
                    <div key={r.id}>
                      {i > 0 && <div className="rm-divider" />}
                      <ReminderRow r={r} label={listLabel(r, k)} anim={animOf(r.id)} onToggle={handleToggle} onOpen={openEdit} onDelete={handleDelete} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <div className="rm-cal-wrap">
          <div className="rm-cal-head">
            <button className="rm-cal-nav" onClick={() => setMonthCursor(new Date(year, month - 1, 1))} aria-label="Предыдущий месяц">‹</button>
            <span className="rm-cal-month">{cap(monthFmt.format(monthCursor))}</span>
            <button className="rm-cal-nav" onClick={() => setMonthCursor(new Date(year, month + 1, 1))} aria-label="Следующий месяц">›</button>
          </div>
          <div className="rm-cal-grid rm-cal-weekdays">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <span className="rm-cal-wd" key={d}>{d}</span>
            ))}
          </div>
          <div className="rm-cal-grid">
            {Array.from({ length: firstWd }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const dateObj = new Date(year, month, day)
              const cls = [
                'rm-cal-day',
                sameDay(dateObj, today) ? 'rm-cal-day--today' : '',
                sameDay(dateObj, selected) ? 'rm-cal-day--sel' : '',
              ].join(' ')
              return (
                <button key={day} className={cls} onClick={() => setSelected(dateObj)}>
                  {day}
                  {daysWithReminders.has(day) && <span className="rm-cal-dot" />}
                </button>
              )
            })}
          </div>

          <h2 className="rm-group-title">{cap(dateFmt.format(selected))} · по времени</h2>
          {selectedItems.length ? (
            <div className="rm-agenda">
              {selectedItems.map((r) => (
                <div className="rm-slot" key={r.id}>
                  <span className="rm-slot-time">{timeFmt.format(new Date(r.remind_at * 1000))}</span>
                  <span className="rm-slot-line" />
                  <button
                    className={r.is_done ? 'rm-slot-card rm-slot-card--done' : 'rm-slot-card'}
                    onClick={() => openEdit(r)}
                  >
                    <span className="rm-item-text">{r.text}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rm-card"><p className="rm-empty">На этот день напоминаний нет</p></div>
          )}
        </div>
      )}

      <button className="fab" onClick={openCreate} aria-label="Новое напоминание">+</button>

      {formOpen && (
        <ReminderFormModal
          initial={editing}
          defaultDate={!editing && tab === 'calendar' ? selected : null}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/tools/ReminderFormModal.jsx ----
cat > "src/views/tools/ReminderFormModal.jsx" <<'WN_TOOLS_EOF'
import { useState } from 'react'
import { newId } from '@/utils/nanoid'
import { useRemindersStore, LEAD_OPTIONS } from '@/stores/reminders'
import { useUiStore } from '@/stores/ui'

const pad = (n) => String(n).padStart(2, '0')

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))

function toDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Default for a new reminder: next full hour, "За 15 минут". The date is
 * the passed `defaultDate` (e.g. the day selected in the calendar) or today.
 */
function defaults(initial, defaultDate) {
  if (initial) {
    const d = new Date(initial.remind_at * 1000)
    return { text: initial.text, date: toDateInput(d), time: toTimeInput(d), lead: initial.lead_minutes }
  }
  const d = defaultDate ? new Date(defaultDate) : new Date()
  const now = new Date()
  d.setHours(now.getHours() + 1, 0, 0, 0)
  return { text: '', date: toDateInput(d), time: toTimeInput(d), lead: 15 }
}

export default function ReminderFormModal({ initial = null, defaultDate = null, onClose, onSaved }) {
  const init = defaults(initial, defaultDate)
  const [text, setText] = useState(init.text)
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [lead, setLead] = useState(init.lead)
  const [busy, setBusy] = useState(false)

  const isEdit = !!initial

  const save = async () => {
    const ui = useUiStore.getState()
    if (!text.trim()) {
      ui.toastError('Введите текст напоминания')
      return
    }
    const ms = new Date(`${date}T${time}`).getTime()
    if (Number.isNaN(ms)) {
      ui.toastError('Укажите дату и время')
      return
    }
    const remind_at = Math.floor(ms / 1000)
    setBusy(true)
    try {
      const store = useRemindersStore.getState()
      if (isEdit) {
        await store.update(initial.id, { text: text.trim(), remind_at, lead_minutes: lead })
      } else {
        await store.create({ id: newId(), text: text.trim(), remind_at, lead_minutes: lead })
      }
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message || 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить напоминание?',
      message: 'Это действие нельзя отменить.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useRemindersStore.getState().remove(initial.id)
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message || 'Не удалось удалить')
      setBusy(false)
    }
  }

  return (
    <div className="rm-modal-overlay" onClick={onClose}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="rm-modal-title">{isEdit ? 'Напоминание' : 'Новое напоминание'}</h2>

        <label className="rm-field">
          <span className="rm-field-label">Что напомнить</span>
          <input
            className="rm-input"
            placeholder="Например: заказать молоко"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </label>

        <label className="rm-field">
          <span className="rm-field-label">Дата</span>
          <input className="rm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="rm-field">
          <span className="rm-field-label">Время (24 ч)</span>
          <div className="rm-time">
            <select
              className="rm-input rm-select"
              value={time.split(':')[0]}
              onChange={(e) => setTime(`${e.target.value}:${time.split(':')[1]}`)}
              aria-label="Часы"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="rm-time-colon">:</span>
            <select
              className="rm-input rm-select"
              value={time.split(':')[1]}
              onChange={(e) => setTime(`${time.split(':')[0]}:${e.target.value}`)}
              aria-label="Минуты"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rm-field">
          <span className="rm-field-label">Напомнить заранее</span>
          <div className="rm-lead-chips">
            {LEAD_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={lead === o.value ? 'rm-chip rm-chip--on' : 'rm-chip'}
                onClick={() => setLead(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rm-modal-actions">
          {isEdit ? (
            <button className="rm-btn rm-btn--danger" onClick={onDelete} disabled={busy}>
              Удалить
            </button>
          ) : (
            <button className="rm-btn rm-btn--ghost" onClick={onClose} disabled={busy}>
              Отмена
            </button>
          )}
          <button className="rm-btn rm-btn--primary" onClick={save} disabled={busy}>
            {busy ? '…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/tools/CalculatorView.jsx ----
cat > "src/views/tools/CalculatorView.jsx" <<'WN_TOOLS_EOF'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '@/styles/calculator.css'

/**
 * Full-screen calculator: + − × ÷, decimals, delete one char, clear the
 * line. History (last 20, persisted) is hidden behind the clock button in
 * the top-right corner and opens as a bottom sheet.
 *
 * Operator precedence (× ÷ before + −) is handled by a tiny two-pass
 * evaluator (no eval()), so e.g. "2 + 3 × 4" = 14.
 */

const HISTORY_KEY = 'wn-calc-history'
const HISTORY_LIMIT = 20

/** Load persisted history (last 20). Tolerates corrupt/missing storage. */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

/** Round to 3 decimals (0.001 precision), then render with a comma decimal. */
function formatNumber(n) {
  const r = Math.round((n + Number.EPSILON) * 1000) / 1000
  return String(r).replace('.', ',')
}

/**
 * Evaluate a display expression (using × ÷ − , symbols).
 * Returns a Number, or null on an invalid expression / division by zero.
 */
function evaluate(raw) {
  const s = raw
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')

  // Tokenize into numbers and operators (supports a leading unary minus
  // and a minus right after another operator).
  const tokens = []
  let num = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if ((c >= '0' && c <= '9') || c === '.') {
      num += c
    } else if ('+-*/'.includes(c)) {
      const prev = tokens[tokens.length - 1]
      if (c === '-' && num === '' && (tokens.length === 0 || typeof prev === 'string')) {
        num = '-' // unary minus
      } else {
        if (num !== '' && num !== '-') tokens.push(parseFloat(num))
        num = ''
        tokens.push(c)
      }
    }
  }
  if (num !== '' && num !== '-') tokens.push(parseFloat(num))
  if (tokens.length === 0 || typeof tokens[0] !== 'number') return null

  // Pass 1: × and ÷
  const pass1 = [tokens[0]]
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const val = tokens[i + 1]
    if (typeof val !== 'number') return null
    if (op === '*') pass1.push(pass1.pop() * val)
    else if (op === '/') {
      if (val === 0) return null
      pass1.push(pass1.pop() / val)
    } else {
      pass1.push(op, val)
    }
  }

  // Pass 2: + and −
  let result = pass1[0]
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i]
    const val = pass1[i + 1]
    if (op === '+') result += val
    else if (op === '-') result -= val
  }

  return Number.isFinite(result) ? result : null
}

const OPERATORS = ['÷', '×', '−', '+']
const isOp = (ch) => OPERATORS.includes(ch)

function IconBack(props) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

function IconClock(props) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export default function CalculatorView() {
  const navigate = useNavigate()
  const [expr, setExpr] = useState('')
  const [justEvaluated, setJustEvaluated] = useState(false)
  const [history, setHistory] = useState(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // Persist history (last 20) whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)))
    } catch {
      /* storage full / unavailable — history just won't persist */
    }
  }, [history])

  const lastChar = expr.slice(-1)

  const pressDigit = useCallback(
    (d) => {
      setExpr((prev) => (justEvaluated ? d : prev + d))
      setJustEvaluated(false)
    },
    [justEvaluated],
  )

  const pressComma = useCallback(() => {
    setExpr((prev) => {
      const base = justEvaluated ? '' : prev
      const segment = base.split(/[÷×−+]/).pop()
      if (segment.includes(',')) return base
      if (segment === '') return base + '0,'
      return base + ','
    })
    setJustEvaluated(false)
  }, [justEvaluated])

  const pressOperator = useCallback((op) => {
    setExpr((prev) => {
      if (prev === '') return op === '−' ? '−' : prev
      if (isOp(prev.slice(-1))) return prev.slice(0, -1) + op
      return prev + op
    })
    setJustEvaluated(false)
  }, [])

  const backspace = useCallback(() => {
    setExpr((prev) => prev.slice(0, -1))
    setJustEvaluated(false)
  }, [])

  const clearAll = useCallback(() => {
    setExpr('')
    setJustEvaluated(false)
  }, [])

  const equals = useCallback(() => {
    if (expr === '' || isOp(lastChar)) return
    const result = evaluate(expr)
    if (result === null) return
    const formatted = formatNumber(result)
    setHistory((prev) => [{ expr, result: formatted }, ...prev].slice(0, HISTORY_LIMIT))
    setExpr(formatted)
    setJustEvaluated(true)
  }, [expr, lastChar])

  const clearHistory = useCallback(() => setHistory([]), [])

  // Tap a past result to continue working with it.
  const applyHistoryResult = (value) => {
    setExpr(value)
    setJustEvaluated(true)
    setShowHistory(false)
  }

  return (
    <div className="page calc-page calc-page--full">
      <header className="sub-header calc-header">
        <button className="back-btn" onClick={() => navigate('/tools')} aria-label="Назад">
          <IconBack />
        </button>
        <h1 className="sub-title">Калькулятор</h1>
        <button
          className={
            showHistory
              ? 'calc-history-btn calc-history-btn--close'
              : 'calc-history-btn'
          }
          onClick={() => setShowHistory((v) => !v)}
          aria-label={showHistory ? 'Закрыть историю' : 'История'}
        >
          {showHistory ? '×' : <IconClock />}
        </button>
      </header>

      <div className="calc calc--full">
        <div className="calc-display" aria-live="polite">
          <span className="calc-expr">{expr || '0'}</span>
        </div>

        <div className="calc-keys">
          <button className="calc-key calc-key--fn" onClick={clearAll}>
            C
          </button>
          <button className="calc-key calc-key--fn" onClick={backspace} aria-label="Стереть символ">
            ⌫
          </button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('÷')}>
            ÷
          </button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('×')}>
            ×
          </button>

          <button className="calc-key" onClick={() => pressDigit('7')}>7</button>
          <button className="calc-key" onClick={() => pressDigit('8')}>8</button>
          <button className="calc-key" onClick={() => pressDigit('9')}>9</button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('−')}>
            −
          </button>

          <button className="calc-key" onClick={() => pressDigit('4')}>4</button>
          <button className="calc-key" onClick={() => pressDigit('5')}>5</button>
          <button className="calc-key" onClick={() => pressDigit('6')}>6</button>
          <button className="calc-key calc-key--op" onClick={() => pressOperator('+')}>
            +
          </button>

          <button className="calc-key" onClick={() => pressDigit('1')}>1</button>
          <button className="calc-key" onClick={() => pressDigit('2')}>2</button>
          <button className="calc-key" onClick={() => pressDigit('3')}>3</button>
          <button className="calc-key calc-key--equals" onClick={equals}>
            =
          </button>

          <button className="calc-key calc-key--zero" onClick={() => pressDigit('0')}>
            0
          </button>
          <button className="calc-key" onClick={pressComma}>,</button>
        </div>
      </div>

      {showHistory && (
        <div className="calc-hist-overlay" onClick={() => setShowHistory(false)}>
          <div className="calc-hist-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calc-hist-head">
              <span className="calc-history-title">История</span>
              {history.length > 0 && (
                <button className="calc-history-clear" onClick={clearHistory}>
                  Очистить
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="calc-history-empty">Пока пусто</p>
            ) : (
              <ul className="calc-history-list">
                {history.map((h, i) => (
                  <li key={i}>
                    <button
                      className="calc-history-item"
                      onClick={() => applyHistoryResult(h.result)}
                    >
                      <span className="calc-history-expr">{h.expr}</span>
                      <span className="calc-history-eq">= {h.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/styles/global.css ----
cat > "src/styles/global.css" <<'WN_TOOLS_EOF'
/* ==========================================================================
   Design tokens — pastel glassmorphism
   These CSS variables are the single source of truth for the visual style.
   Migrating components: replace hardcoded colors / shadows with var(--wn-...).
   ========================================================================== */

:root {
  /* === Surfaces (glass) === */
  --wn-glass-light: rgba(255, 255, 255, 0.72);
  --wn-glass-medium: rgba(255, 255, 255, 0.85);
  --wn-glass-strong: rgba(255, 255, 255, 0.95);

  --wn-glass-border: rgba(255, 255, 255, 0.4);
  --wn-glass-border-subtle: rgba(0, 0, 0, 0.06);

  /* === Pastel palette === */
  --wn-mint-bg: #e8f5ec;
  --wn-mint: #a8d5b4;
  --wn-mint-ink: #2e7d32;

  --wn-peach-bg: #fff0e6;
  --wn-peach: #f4c4a3;
  --wn-peach-ink: #c25e1a;

  --wn-rose-bg: #fde8e8;
  --wn-rose: #f5b8b8;
  --wn-rose-ink: #c62828;

  --wn-sky-bg: #e6f0fa;
  --wn-sky: #b6d4ec;
  --wn-sky-ink: #1565c0;

  --wn-lavender-bg: #f0ecf6;
  --wn-lavender: #c9beda;
  --wn-lavender-ink: #6a4190;

  --wn-sand-bg: #faf6f0;
  --wn-sand: #e8dcc4;
  --wn-sand-ink: #8b6f3d;

  /* === Text === */
  --wn-ink: #1a1a1a;
  --wn-ink-soft: #555;
  --wn-ink-mute: #888;
  --wn-ink-faint: #b0b0b0;

  /* === Backgrounds === */
  --wn-bg: #f5f5f7;
  --wn-bg-elevated: #ffffff;
  --wn-bg-recessed: #ebebef;

  /* === Accent (primary action) === */
  --wn-accent: #4caf50;
  --wn-accent-soft: #a8d5b4;
  --wn-accent-bg: #e8f5ec;
  --wn-accent-ink: #2e7d32;

  --wn-accent-fill: var(--wn-accent-bg);
  --wn-accent-text: var(--wn-accent-ink);
  --wn-focus: var(--wn-accent);

  --wn-danger: #f5334f;
  --wn-info: #2f80ed;
  --wn-warn: #e8830c;
  --wn-grid-line: var(--wn-glass-border-subtle);

  /* === Shadows === */
  --wn-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.03);
  --wn-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04);
  --wn-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
  --wn-shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04);

  /* === Radii === */
  --wn-radius-sm: 8px;
  --wn-radius-md: 12px;
  --wn-radius-lg: 16px;
  --wn-radius-xl: 22px;
  --wn-radius-pill: 999px;

  /* === Blur === */
  --wn-blur-sm: 10px;
  --wn-blur-md: 18px;
  --wn-blur-lg: 30px;
}

/* ==========================================================================
   Dark theme — token overrides only.
   Activated by the settings store via <html data-theme="dark"> (manual)
   or the resolved value of "Авто" (follows Telegram / OS color scheme).
   ========================================================================== */
:root[data-theme='dark'] {
  --wn-glass-light: rgba(28, 28, 36, 0.72);
  --wn-glass-medium: rgba(28, 28, 36, 0.86);
  --wn-glass-strong: rgba(28, 28, 36, 0.96);
  --wn-glass-border: rgba(255, 255, 255, 0.08);
  --wn-glass-border-subtle: rgba(255, 255, 255, 0.06);

  --wn-ink: #f2f2f6;
  --wn-ink-soft: #bdbdc7;
  --wn-ink-mute: #8c8c98;
  --wn-ink-faint: #5c5c66;

  --wn-bg: #131318;
  --wn-bg-elevated: #1e1e26;
  --wn-bg-recessed: #2a2a34;

  --wn-accent-fill: color-mix(in srgb, var(--wn-accent) 24%, #1e1e26);
  --wn-accent-text: color-mix(in srgb, var(--wn-accent) 62%, #ffffff);
  --wn-danger: #ff5168;
  --wn-info: #5b9bf5;
  --wn-warn: #f0a445;

  --wn-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --wn-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.4);
  --wn-shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.45);
  --wn-shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4);
}

:root {
  color-scheme: light;
}
:root[data-theme='dark'] {
  color-scheme: dark;
}

/* ==========================================================================
   Global resets and mobile-friendly defaults.
   ========================================================================== */

* {
  touch-action: manipulation;
}

/* СТАЛО */
html, body {
  margin: 0;
  padding: 0;
  /* Block horizontal scroll on the document level. Pages internally
     are 100vw — anything wider is a bug that should be visible-not-scrollable
     (overflow-x: hidden on .app-shell already blocks the visual, this
     blocks the actual gesture). */
  overscroll-behavior: none;
  overflow-x: hidden;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

#app {
  /* Already exists with height. Add this if missing: */
  overflow-x: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-user-select: none;
  user-select: none;
  /* Carried over from App.vue's scoped styles — see .app-shell note below.
     Setting these on body too prevents a light flash before .app-shell
     paints, and neutralises Telegram's inline --tg-theme-text-color on
     <html>. (Known dark-theme root cause from the Vue project.) */
  color: var(--wn-ink);
  background-color: var(--wn-bg);
}

input, textarea, [contenteditable="true"], [data-selectable] {
  -webkit-user-select: text;
  user-select: text;
}

* {
  -webkit-tap-highlight-color: transparent;
}

:focus-visible {
  outline: 2px solid var(--wn-focus);
  outline-offset: 2px;
}

button {
  font-family: inherit;
}

input, textarea, select {
  color: var(--wn-ink);
  caret-color: var(--wn-accent);
}

input::placeholder, textarea::placeholder {
  color: var(--wn-ink-faint);
}

/* ==========================================================================
   App shell layout.
   MIGRATION NOTE: in the Vue project these lived in App.vue's <style scoped>.
   React has no scoped <style>, so the shell layout moves here to global.css.
   The rules are unchanged — same tokens, same scroll-isolation strategy.
   ========================================================================== */

#app {
  height: 100vh;
  height: 100dvh;
}

.app-shell {
  /* Pin to viewport height so the only scroll container is .app-content.
     Keeps route changes from inheriting the previous page's scroll offset. */
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--wn-bg);
  color: var(--wn-ink);
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling: touch;
}

.app-content--full {
  padding-bottom: 0;
  /* Full-screen routes manage their own scrolling and use height:100dvh. */
  overflow: hidden;
}

/* ==========================================================================
   Boot screen (loading spinner + error state).
   MIGRATION NOTE: these lived in App.vue's <style scoped>. App.jsx renders
   the same .boot / .spinner / .boot-* markup, so the rules move to global.
   Unchanged from the Vue version apart from location.
   ========================================================================== */

.boot {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 32px;
  text-align: center;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--wn-bg-recessed);
  border-top-color: var(--wn-accent);
  border-radius: 50%;
  animation: wn-spin 0.8s linear infinite;
}

@keyframes wn-spin {
  to {
    transform: rotate(360deg);
  }
}

.boot-text {
  color: var(--wn-ink-mute);
  font-size: 14px;
  margin: 0;
}

.boot-error {
  color: var(--wn-danger);
  font-size: 15px;
  margin: 0;
}

.boot-retry {
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background-color: var(--wn-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.boot-logs {
  margin-top: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--wn-ink-mute);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

/* ==========================================================================
   Toasts + ConfirmDialog.
   MIGRATION NOTE: these were <style scoped> in ToastContainer.vue /
   ToastItem.vue / ConfirmDialog.vue. React has no scoped styles, so they
   move here. Vue <transition>/<transition-group> enter animations are
   replaced with CSS keyframes (wn-toast-in / wn-overlay-in / wn-dialog-in).
   Dialog class names are prefixed (.dialog-title etc.) to avoid clashing
   with generic .title/.message used by screens.
   ========================================================================== */

/* ----- Toasts ----- */
.toast-stack {
  position: fixed;
  top: calc(env(safe-area-inset-top) + 12px);
  left: 12px;
  right: 12px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  padding: 12px 16px;
  border-radius: 12px;
  background-color: #2f2f37;
  color: #fff;
  font-size: 14px;
  line-height: 1.35;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  word-wrap: break-word;
  touch-action: pan-y;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 12px;
}

.toast-msg {
  flex: 1;
  min-width: 0;
}

.toast-action {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
}
.toast-action:active {
  background: rgba(255, 255, 255, 0.28);
}

.toast--success { background-color: #2e7d32; }
.toast--error   { background-color: #c62828; }
.toast--warning { background-color: #ef6c00; }
.toast--info    { background-color: #455a64; }

.wn-toast-in {
  animation: wn-toast-in 0.2s ease;
}
@keyframes wn-toast-in {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ----- Confirm / generic modal dialog ----- */
.overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.dialog {
  background-color: var(--wn-bg-elevated);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 360px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.dialog-title {
  margin: 0 0 8px 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--wn-ink);
}

.dialog-message {
  margin: 0 0 18px 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--wn-ink-soft);
}

.dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 9px 16px;
  border-radius: 10px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.btn:active { opacity: 0.8; }
.btn--ghost { background-color: transparent; color: var(--wn-ink-soft); }
.btn--primary { background-color: var(--wn-accent); color: #fff; }
.btn--danger { background-color: #d32f2f; color: #fff; }

.wn-overlay-in { animation: wn-overlay-in 0.18s ease; }
@keyframes wn-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.wn-dialog-in { animation: wn-dialog-in 0.18s ease; }
@keyframes wn-dialog-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ==========================================================================
   PromptHost (text-input modal).
   MIGRATION NOTE: from PromptModal.vue <style scoped>. Anchored near the top
   so the keyboard never covers it. Vue's prompt-fade transition → wn-prompt-in
   keyframe. The footer buttons reuse .btn but need flex:1 + bigger padding,
   so they're scoped under .prompt-footer to override the shared .btn rules
   (which in Vue were isolated by scoped styles).
   ========================================================================== */

.prompt-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 56px 16px 16px;
  touch-action: none;
}

.prompt-modal {
  width: 100%;
  max-width: 480px;
  background-color: var(--wn-bg-elevated);
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  touch-action: auto;
}

.prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 8px 16px;
}

.prompt-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--wn-ink);
  flex: 1;
  min-width: 0;
}

.prompt-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--wn-ink-mute);
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-body {
  padding: 4px 16px 12px 16px;
}

.prompt-input {
  width: 100%;
  font-family: inherit;
  font-size: 15px;
  padding: 10px 12px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink);
  transition: border-color 0.15s ease;
}

.prompt-input:focus {
  border-color: var(--wn-accent, #4caf50);
  background-color: var(--wn-bg-elevated);
}

.prompt-input--multiline {
  resize: vertical;
  min-height: 80px;
  line-height: 1.4;
}

.prompt-footer {
  display: flex;
  gap: 8px;
  padding: 8px 16px 16px 16px;
}

/* Override the shared .btn for prompt footer buttons only. */
.prompt-footer .btn {
  flex: 1;
  padding: 11px 16px;
  border-radius: 12px;
  font-weight: 600;
}
.prompt-footer .btn--ghost {
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink);
}
.prompt-footer .btn--primary {
  background-color: var(--wn-accent, #4caf50);
  color: #fff;
}
.prompt-footer .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wn-prompt-in {
  animation: wn-prompt-in 0.18s ease;
}
@keyframes wn-prompt-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ==========================================================================
   DiagnosticsPanel.
   MIGRATION NOTE: from DiagnosticsPanel.vue <style scoped>. Bottom-sheet
   style log viewer. Hardcoded greys from the Vue original were swapped to
   tokens where they were theme-sensitive (the .diag-btn--ghost bg).
   ========================================================================== */

.diag-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
}
.diag-panel {
  background: var(--wn-bg-elevated);
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  border-radius: 14px 14px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.diag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.diag-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--wn-ink);
}
.diag-x {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--wn-ink-mute);
  cursor: pointer;
}
.diag-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.diag-btn {
  flex: 1;
  min-width: 120px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: var(--wn-accent);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.diag-btn--ghost {
  background: var(--wn-bg-recessed);
  color: var(--wn-ink-soft);
}
.diag-btn:disabled {
  opacity: 0.6;
}
.diag-env {
  padding: 8px 16px;
  background: var(--wn-bg-recessed);
  font-size: 11px;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.diag-env-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
}
.diag-env-k {
  color: var(--wn-ink-mute);
  flex-shrink: 0;
  min-width: 90px;
}
.diag-env-v {
  color: var(--wn-ink-soft);
  word-break: break-all;
}
.diag-log {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11px;
}
.diag-empty {
  color: var(--wn-ink-faint);
  text-align: center;
  padding: 20px;
}
.diag-line {
  padding: 3px 0;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  word-break: break-all;
}
.diag-line--error { color: var(--wn-danger); }
.diag-line--net { color: var(--wn-ink-soft); }
.diag-line--info { color: var(--wn-ink-mute); }
.diag-time {
  color: var(--wn-ink-faint);
  margin-right: 6px;
}
.diag-extra {
  display: block;
  color: var(--wn-ink-mute);
  padding-left: 12px;
}
.diag-copied {
  text-align: center;
  color: var(--wn-accent-text);
  font-size: 12px;
  padding: 6px;
}

/* ==========================================================================
   BottomNavigation + PrimaryAction.
   MIGRATION NOTE: from BottomNavigation.vue / PrimaryAction.vue scoped styles.
   Unchanged apart from location.
   ========================================================================== */

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 76px;
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;

  background: var(--wn-glass-light);
  -webkit-backdrop-filter: blur(var(--wn-blur-md)) saturate(180%);
  backdrop-filter: blur(var(--wn-blur-md)) saturate(180%);
  border-top: 1px solid var(--wn-glass-border);
  box-shadow: var(--wn-shadow-glass);
}

.bottom-nav--no-blur {
  background: var(--wn-glass-strong);
}

.nav-content {
  position: relative;
  height: 100%;
  display: flex;
  align-items: stretch;
  justify-content: space-around;
}

.indicator {
  position: absolute;
  top: 9px;
  width: 10%;
  height: 30px;
  border-radius: var(--wn-radius-pill);
  background-color: var(--wn-accent-fill);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.6),
    0 1px 2px color-mix(in srgb, var(--wn-accent) 18%, transparent);
  transition:
    left 0.32s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease;
  pointer-events: none;
}

.nav-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-decoration: none;
  color: var(--wn-ink-mute);
  z-index: 1;
  transition: transform 0.18s ease;
}

.nav-item:active {
  transform: scale(0.92);
}

.nav-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
}

.nav-icon {
  width: 22px;
  height: 22px;
  transition: color 0.22s ease, transform 0.22s ease;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1;
  transition: color 0.22s ease, font-weight 0.22s ease;
}

.nav-item--active {
  color: var(--wn-accent-text);
}
.nav-item--active .nav-icon {
  transform: scale(1.05);
}
.nav-item--active .nav-label {
  font-weight: 600;
}

/* ----- PrimaryAction ----- */
.primary-action {
  position: fixed;
  left: 50%;
  bottom: calc(76px + 12px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  min-width: 180px;
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 999px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;

  background-color: var(--wn-accent, #4caf50);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--wn-accent) 35%, transparent);

  z-index: 60;
  transition:
    transform 0.15s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.18s ease;
}

.primary-action:active {
  transform: translateX(-50%) scale(0.96);
}
.primary-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.primary-action--accent {
  box-shadow: 0 8px 24px color-mix(in srgb, var(--wn-accent) 50%, transparent);
}
.primary-action-label {
  white-space: nowrap;
}

/* ==========================================================================
   Shared form fields (.field / .field-label / .field-input).
   MIGRATION NOTE: many Vue screens repeated these in scoped styles. Since
   React has no scoping, define them ONCE here and reuse across views.
   ========================================================================== */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-mute);
}
.field-input {
  width: 100%;
  font-family: inherit;
  font-size: 15px;
  padding: 12px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  outline: none;
  box-sizing: border-box;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.field-input:focus {
  border-color: var(--wn-accent, #4caf50);
  background-color: var(--wn-bg-elevated);
}

/* ==========================================================================
   BotRequiredView (gate).
   Class names prefixed (gate-btn-*) so they don't clash with shared .btn.
   ========================================================================== */
.gate {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--wn-bg);
}
.gate-card {
  background: var(--wn-bg-elevated);
  padding: 32px 24px;
  border-radius: 16px;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: var(--wn-shadow-md);
}
.gate-icon { font-size: 48px; margin-bottom: 16px; }
.gate-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--wn-ink);
}
.gate-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--wn-ink-soft);
  margin: 0 0 24px;
}
.gate-btn-primary,
.gate-btn-secondary {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.gate-btn-primary {
  background-color: var(--wn-accent);
  color: #fff;
  margin-bottom: 10px;
}
.gate-btn-primary:disabled { opacity: 0.6; }
.gate-btn-secondary {
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-soft);
}
.gate-btn-secondary:disabled { opacity: 0.6; }

/* ==========================================================================
   OnboardingView.
   Class names prefixed (ob-step / ob-btn / ob-form) to avoid clashing with
   generic .step/.btn used elsewhere.
   ========================================================================== */
.onboarding {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
  background-color: var(--wn-bg-elevated);
  box-sizing: border-box;
}
.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--wn-bg-recessed);
  transition: background-color 0.2s ease, width 0.2s ease;
}
.dot--active {
  background-color: var(--wn-accent, #4caf50);
  width: 22px;
  border-radius: 4px;
}
.ob-step {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.hero { text-align: center; margin-top: 48px; }
.hero-icon { font-size: 64px; line-height: 1; }
.hero-title {
  margin: 16px 0 4px;
  font-size: 28px;
  font-weight: 700;
  color: var(--wn-ink);
}
.hero-subtitle { margin: 0; font-size: 15px; color: var(--wn-ink-mute); }
.step-title {
  margin: 24px 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--wn-ink);
}
.step-text {
  margin: 12px 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--wn-ink-soft);
}
.features {
  list-style: none;
  margin: 16px 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.feature { display: flex; gap: 14px; align-items: flex-start; }
.feature-icon { font-size: 28px; line-height: 1; flex-shrink: 0; }
.feature-name { font-size: 15px; font-weight: 600; color: var(--wn-ink); }
.feature-desc {
  font-size: 13px;
  color: var(--wn-ink-mute);
  line-height: 1.4;
  margin-top: 2px;
}
.ob-form {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.step-actions {
  margin-top: auto;
  padding-top: 24px;
  display: flex;
  gap: 10px;
}
.ob-btn {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}
.ob-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ob-btn--primary { background-color: var(--wn-accent, #4caf50); color: #fff; }
.ob-btn--ghost {
  flex: 0 0 auto;
  min-width: 96px;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink);
}

/* ==========================================================================
   Shared page primitives (.page, .btn-primary, empty states, section bits).
   Defined ONCE here; screen-specific layout uses prefixed classes.
   ========================================================================== */
.page {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  background-color: var(--wn-bg);
  min-height: 100%;
  color: var(--wn-ink);
  box-sizing: border-box;
}
.btn-primary {
  background-color: var(--wn-accent);
  color: #fff;
  border: none;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.btn-primary--small { padding: 9px 16px; font-size: 13px; }
.btn-primary:active { opacity: 0.85; }
.empty-block {
  background-color: var(--wn-bg-elevated);
  border-radius: 16px;
  padding: 28px 20px;
  text-align: center;
}
.empty-title {
  margin: 0 0 6px 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--wn-ink);
}
.empty-text {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--wn-ink-soft);
  line-height: 1.45;
}
.section-counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  font-size: 12px;
  font-weight: 600;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;
}
.section-subline {
  font-size: 13px;
  color: var(--wn-ink-mute);
  margin-bottom: 10px;
}
.history-btn {
  background: none;
  border: none;
  color: var(--wn-ink-mute);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

/* ===== Main (home) screen ===== */
.main-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.main-header-left { flex: 1; min-width: 0; }
.greeting {
  margin: 0 0 2px 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--wn-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.main-date {
  margin: 0;
  font-size: 13px;
  color: var(--wn-ink-mute);
  text-transform: capitalize;
}
.main-section { margin-bottom: 22px; }
.main-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.cta {
  background-color: var(--wn-bg-elevated);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.cta-text { flex: 1; }
.cta-title {
  margin: 0 0 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--wn-ink);
}
.cta-sub { margin: 0; font-size: 12px; color: var(--wn-ink-mute); }

/* ===== WorkplaceSwitcher (switcher-*) ===== */
.switcher { position: relative; }
.switcher-label {
  font-size: 13px;
  color: var(--wn-ink-mute);
  font-weight: 500;
}
.switcher-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
}
.switcher-trigger:active { background-color: var(--wn-bg-recessed); }
.switcher-trigger-text {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.switcher-chev {
  font-size: 9px;
  transition: transform 0.18s ease;
  color: var(--wn-ink-mute);
}
.switcher-chev--open { transform: rotate(180deg); }
.switcher-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 180px;
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  box-shadow: var(--wn-shadow-lg);
  overflow: hidden;
}
.switcher-menu-list { display: flex; flex-direction: column; }
.switcher-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  color: var(--wn-ink);
  text-align: left;
}
.switcher-menu-item:active { background-color: var(--wn-bg-recessed); }
.switcher-menu-item--current { color: var(--wn-accent-text); font-weight: 600; }
.switcher-menu-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.switcher-menu-check { flex-shrink: 0; }

/* ===== ActiveOrdersList (aol-*) ===== */
.aol-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 16px;
  color: var(--wn-ink-mute);
  font-size: 13px;
}
.aol-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  font-size: 13px;
  font-weight: 700;
}
.aol-list { display: flex; flex-direction: column; gap: 6px; }
.aol-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--wn-bg-elevated);
  border: none;
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  width: 100%;
}
.aol-row:active { background-color: var(--wn-bg-recessed); }
.aol-table {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background-color: color-mix(in srgb, var(--wn-warn) 16%, var(--wn-bg-elevated));
  border-radius: 10px;
  color: color-mix(in srgb, var(--wn-warn) 72%, var(--wn-ink));
}
.aol-table-label {
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  line-height: 1;
  margin-bottom: 1px;
}
.aol-table-num {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.aol-main { flex: 1; min-width: 0; }
.aol-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wn-ink);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aol-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wn-ink-mute);
}
.aol-time { font-variant-numeric: tabular-nums; }
.aol-dot { color: var(--wn-ink-faint); }
.aol-items { font-variant-numeric: tabular-nums; }
.aol-items--all-served { color: var(--wn-mint-ink, #2e7d32); font-weight: 600; }
.aol-comment {
  font-size: 12px;
  color: var(--wn-peach-ink, #c25e1a);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}
.aol-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--wn-ink);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* ==========================================================================
   Reusable bottom-sheet modal (sheet-*) + form bits.
   MIGRATION NOTE: every Vue form modal (workplace, category, item, note,
   hall) repeated this .overlay/.sheet/.actions block in scoped styles.
   Defined ONCE here as sheet-* so all ported modals share it.
   ========================================================================== */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 250;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  background-color: var(--wn-bg-elevated);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  animation: wn-sheet-in 0.22s ease;
}
@keyframes wn-sheet-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
.sheet-header {
  position: sticky;
  top: 0;
  background-color: var(--wn-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px 20px;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  z-index: 1;
}
.sheet-title { margin: 0; font-size: 17px; font-weight: 600; color: var(--wn-ink); }
.sheet-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--wn-ink-mute);
  cursor: pointer;
  width: 32px;
  height: 32px;
}
.sheet-form {
  padding: 16px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sheet-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.sheet-actions-spacer { flex: 1; }

/* form modal radio group (fm-*) */
.fm-fieldset {
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0;
}
.fm-legend {
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-mute);
  padding: 0 6px;
}
.fm-radio-row { display: flex; flex-direction: column; gap: 8px; }
.fm-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--wn-ink);
  cursor: pointer;
}

/* shared .btn variants used by sheets */
.btn--danger-ghost {
  background-color: transparent;
  color: var(--wn-danger);
}
.btn--ghost-danger {
  background-color: transparent;
  color: var(--wn-danger);
}

/* ==========================================================================
   Shared cards + action rows (used by Profile, Workplaces, etc.)
   ========================================================================== */
.card {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.card:active { background-color: var(--wn-bg-recessed); }
.card--current {
  border: 1.5px solid var(--wn-accent-soft);
  background-color: var(--wn-accent-fill);
}
.card-main { flex: 1; min-width: 0; }
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  background-color: var(--wn-accent);
  color: #fff;
}
.card-badge--muted {
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-mute);
}
.card-meta { font-size: 13px; color: var(--wn-ink-mute); }
.card-chev { font-size: 20px; color: var(--wn-ink-faint); flex-shrink: 0; }

.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background-color: var(--wn-bg-elevated);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background-color 0.15s ease;
}
.action-row:active { background-color: var(--wn-bg-recessed); }
.action-icon { font-size: 22px; flex-shrink: 0; }
.action-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.action-name { font-size: 15px; font-weight: 500; color: var(--wn-ink); }
.action-meta {
  font-size: 12px;
  color: var(--wn-ink-mute);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-chev { font-size: 20px; color: var(--wn-ink-faint); flex-shrink: 0; }

/* ==========================================================================
   ProfileView (pf-*, tg-id-*).
   ========================================================================== */
.pf-header { margin-bottom: 24px; }
.pf-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pf-header-main { display: flex; flex-direction: column; gap: 4px; }
.pf-title { font-size: 26px; font-weight: 700; margin: 0; color: var(--wn-ink); }
.pf-subtitle { margin: 0; color: var(--wn-ink-mute); font-size: 14px; }
.pf-section { margin-bottom: 22px; }
.pf-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}
.pf-list { display: flex; flex-direction: column; gap: 8px; }

.tg-id-row {
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tg-id-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tg-id-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tg-id-value {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tg-id-actions { display: flex; gap: 4px; }
.tg-id-btn {
  background-color: var(--wn-bg-recessed);
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tg-id-btn:active { opacity: 0.7; }

/* ==========================================================================
   Shared sub-screen header (back button + title).
   MIGRATION NOTE: every /profile/* and editor screen repeats this. Define
   once as sub-header/back-btn/sub-title.
   ========================================================================== */
.sub-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.back-btn {
  background: none;
  border: none;
  font-size: 22px;
  line-height: 1;
  color: var(--wn-ink);
  cursor: pointer;
  padding: 4px 8px;
}
.sub-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  color: var(--wn-ink);
}

/* ==========================================================================
   AppearanceView (perso-*, swatch, seg).
   ========================================================================== */
.perso-card {
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: var(--wn-radius-lg);
  box-shadow: var(--wn-shadow-sm);
  overflow: hidden;
}
.perso-block {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.perso-divider { height: 1px; background-color: var(--wn-glass-border-subtle); }
.perso-label { font-size: 13px; font-weight: 600; color: var(--wn-ink-soft); }
.swatches { display: flex; gap: 12px; flex-wrap: wrap; }
.swatch {
  width: 40px;
  height: 40px;
  border-radius: var(--wn-radius-pill);
  border: none;
  padding: 0;
  cursor: pointer;
  background-color: var(--sw);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--sw) 45%, transparent);
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: transform 0.15s ease, outline-color 0.15s ease;
}
.swatch:active { transform: scale(0.9); }
.swatch--active { outline-color: var(--sw); }
.swatch-check { width: 22px; height: 22px; }
.seg {
  display: flex;
  background-color: var(--wn-bg-recessed);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
}
.seg-btn {
  flex: 1;
  background-color: transparent;
  border: none;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.seg-btn--on {
  background-color: var(--wn-bg-elevated);
  color: var(--wn-ink);
  box-shadow: var(--wn-shadow-sm);
}
.perso-hint { margin: 0; font-size: 12px; color: var(--wn-ink-mute); line-height: 1.4; }

/* ==========================================================================
   WorkplacesView (wv-*, btn-add, card-action, card--archived).
   ========================================================================== */
.btn-add {
  margin-left: auto;
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.btn-add:active { opacity: 0.8; }
.wv-list { display: flex; flex-direction: column; gap: 8px; }
.wv-empty {
  text-align: center;
  padding: 40px 16px;
}
.card-action {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 8px;
}
.card-action:active { background-color: var(--wn-bg-recessed); }
.card--archived {
  opacity: 0.7;
  cursor: default;
}
.card--archived:active { background-color: var(--wn-bg-elevated); }

/* ==========================================================================
   ShareView / ImportSharesSection / ShareCard (share-*, ttl-*, btn-create…)
   ========================================================================== */
.share-hint {
  font-size: 13px;
  color: var(--wn-ink-mute);
  line-height: 1.45;
  margin: 0 0 14px;
}
.share-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--wn-ink-mute);
  font-size: 14px;
}
.shares-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.share-card {
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
}
.share-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.share-code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--wn-accent-text);
  cursor: pointer;
  user-select: all;
}
.icon-btn {
  background: none;
  border: none;
  font-size: 15px;
  cursor: pointer;
  color: var(--wn-ink-mute);
  width: 30px;
  height: 30px;
  border-radius: 8px;
}
.icon-btn:active { background-color: var(--wn-bg-recessed); }
.icon-btn--danger { color: var(--wn-danger); }
.share-meta {
  display: flex;
  gap: 14px;
  font-size: 12px;
  color: var(--wn-ink-mute);
  margin-bottom: 10px;
}
.share-actions { display: flex; gap: 6px; }
.share-btn {
  flex: 1;
  background-color: var(--wn-bg-recessed);
  border: none;
  border-radius: 8px;
  padding: 8px 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--wn-ink-soft);
  font-family: inherit;
}
.share-btn:active { opacity: 0.8; }
.share-btn--primary {
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  font-weight: 600;
}
.btn-create {
  width: 100%;
  background-color: var(--wn-accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  margin-bottom: 10px;
}
.btn-create:disabled { opacity: 0.6; }
.btn-import {
  width: 100%;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-soft);
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

/* TTL prompt (small centered modal, reuses .sheet-overlay backdrop) */
.ttl-prompt {
  margin: auto;
  background-color: var(--wn-bg-elevated);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 340px;
  align-self: center;
}
.sheet-overlay:has(.ttl-prompt) { align-items: center; }
.ttl-title { margin: 0 0 6px; font-size: 16px; font-weight: 600; color: var(--wn-ink); }
.ttl-hint { margin: 0 0 14px; font-size: 13px; color: var(--wn-ink-mute); }
.ttl-actions { display: flex; gap: 8px; margin-top: 14px; }
.ttl-actions .btn { flex: 1; }

/* ==========================================================================
   DevToolsView (dev-*).
   ========================================================================== */
.dev-card {
  padding: 16px;
  background-color: color-mix(in srgb, var(--wn-warn) 12%, var(--wn-bg-elevated));
  border: 1px dashed color-mix(in srgb, var(--wn-warn) 45%, var(--wn-bg-elevated));
  border-radius: 12px;
}
.dev-hint {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--wn-ink-mute);
  font-style: italic;
}
.dev-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-dev {
  background-color: var(--wn-bg-elevated);
  color: var(--wn-ink-soft);
  border: 1px solid color-mix(in srgb, var(--wn-warn) 40%, var(--wn-bg-elevated));
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}
.btn-dev:active { background-color: var(--wn-bg-recessed); }
.btn-dev--danger {
  border-color: color-mix(in srgb, var(--wn-danger) 45%, var(--wn-bg-elevated));
  color: var(--wn-danger);
}

/* ==========================================================================
   Shared: search box, tabs, FAB, loading spinner (used by Notes, Menu…).
   ========================================================================== */
.search-wrap { position: relative; margin-bottom: 12px; }
.search-input {
  width: 100%;
  padding: 10px 36px 10px 14px;
  font-size: 14px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  background-color: var(--wn-bg-elevated);
  color: var(--wn-ink);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.15s ease;
}
.search-input:focus { border-color: var(--wn-accent-text); }
.search-clear {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  color: var(--wn-ink-faint);
  cursor: pointer;
  padding: 4px 8px;
}

.tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  margin-bottom: 14px;
  padding-bottom: 2px;
}
.tabs::-webkit-scrollbar { display: none; }
.tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 18px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.tab--active {
  background-color: var(--wn-accent);
  border-color: var(--wn-accent-text);
  color: #fff;
}
.tab-count {
  font-size: 11px;
  background-color: rgba(0, 0, 0, 0.08);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}
.tab--active .tab-count { background-color: rgba(255, 255, 255, 0.25); }

.loading { display: flex; justify-content: center; padding: 60px 0; }
.loading .spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--wn-bg-recessed);
  border-top-color: var(--wn-accent-text);
  border-radius: 50%;
  animation: wn-spin 0.8s linear infinite;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: calc(80px + env(safe-area-inset-bottom));
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--wn-accent);
  color: #fff;
  border: none;
  font-size: 28px;
  line-height: 1;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--wn-accent) 40%, transparent);
  cursor: pointer;
  z-index: 10;
  transition: transform 0.15s ease;
}
.fab:active { transform: scale(0.92); }

/* ==========================================================================
   Notes screen (notes-*, note-card, note-scope) + NoteFormModal (nf-*).
   ========================================================================== */
.notes-page { padding-bottom: 100px; }
.notes-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.notes-header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.notes-title { font-size: 26px; font-weight: 700; margin: 0; color: var(--wn-ink); }
.archive-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--wn-ink-mute);
  cursor: pointer;
  user-select: none;
}
.archive-toggle input { accent-color: var(--wn-accent-text); }
.notes-empty {
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 32px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.note-card {
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background-color 0.15s ease;
}
.note-card:active { background-color: var(--wn-bg-recessed); }
.note-card--pinned { border-left-color: var(--wn-warn); }
.note-card--archived { opacity: 0.6; }
.note-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.note-pin { font-size: 13px; }
.note-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-content {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--wn-ink-soft);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.note-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.note-scope {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-mute);
}
.note-scope--shift { background-color: var(--wn-sky-bg); color: var(--wn-sky-ink); }
.note-scope--workplace { background-color: var(--wn-mint-bg); color: var(--wn-mint-ink); }
.note-scope--global { background-color: var(--wn-lavender-bg); color: var(--wn-lavender-ink); }
.note-date { font-size: 11px; color: var(--wn-ink-faint); }

/* NoteFormModal specifics */
.nf-pin {
  background: none;
  border: none;
  font-size: 16px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.4;
  transition: opacity 0.15s ease, background-color 0.15s ease;
}
.nf-pin--active {
  opacity: 1;
  background-color: color-mix(in srgb, var(--wn-warn) 18%, var(--wn-bg-elevated));
}
.nf-title-input { font-size: 16px; font-weight: 600; }
.nf-content-input { resize: vertical; min-height: 120px; line-height: 1.45; }
.nf-scope-readonly { display: flex; flex-direction: column; gap: 6px; }
.nf-scope-hint { font-size: 12px; color: var(--wn-ink-mute); }

/* ==========================================================================
   Shifts screen (sh-*) + CurrentShiftCard (csc-*) + OpenShiftButton (osb-*)
   + ShiftHistoryItem (sh-row…) + ShiftDetailsModal (sdm-*).
   ========================================================================== */
.sh-header {
  margin-bottom: 20px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.sh-title { font-size: 26px; font-weight: 700; margin: 0; color: var(--wn-ink); }
.sh-subtitle {
  font-size: 13px;
  color: var(--wn-ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 50%;
}
.sh-section { margin-bottom: 24px; }
.sh-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}
.empty-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 16px;
  color: var(--wn-ink-mute);
}
.sh-empty {
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
}
.sh-history-list { display: flex; flex-direction: column; gap: 6px; }
.sh-more {
  width: 100%;
  margin-top: 8px;
  background-color: var(--wn-bg-elevated);
  color: var(--wn-accent-text);
  border: 1px solid var(--wn-accent-soft);
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.sh-more:active { background-color: var(--wn-bg-recessed); }
.sh-loading { display: flex; justify-content: center; padding: 16px; }
.sh-spinner-small {
  width: 18px;
  height: 18px;
  border: 2px solid var(--wn-bg-recessed);
  border-top-color: var(--wn-accent-text);
  border-radius: 50%;
  animation: wn-spin 0.8s linear infinite;
}

/* ShiftHistoryItem rows */
.sh-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--wn-bg-elevated);
  padding: 12px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.sh-row:active { background-color: var(--wn-bg-recessed); }
.sh-row-main { flex: 1; min-width: 0; }
.sh-row-date { font-size: 14px; font-weight: 600; color: var(--wn-ink); margin-bottom: 2px; }
.sh-row-meta {
  font-size: 12px;
  color: var(--wn-ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sh-row-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.sh-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--wn-accent-text);
  font-variant-numeric: tabular-nums;
}
.sh-tips { font-size: 11px; color: var(--wn-ink-mute); }

/* CurrentShiftCard */
.csc-card {
  background: linear-gradient(135deg, var(--wn-accent) 0%, color-mix(in srgb, var(--wn-accent) 85%, #000) 100%);
  color: #fff;
  border-radius: 16px;
  padding: 18px 18px 16px 18px;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--wn-accent) 30%, transparent);
}
.csc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.csc-dot {
  width: 8px;
  height: 8px;
  background-color: #fff;
  border-radius: 50%;
  animation: csc-pulse 1.6s ease-in-out infinite;
}
@keyframes csc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}
.csc-status {
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
}
.csc-close {
  background-color: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
}
.csc-close:not(:disabled):active { background-color: rgba(255, 255, 255, 0.3); }
.csc-close:disabled { opacity: 0.5; cursor: not-allowed; }
.csc-duration {
  font-size: 36px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
  margin-top: 4px;
}
.csc-started { font-size: 12px; opacity: 0.8; margin-bottom: 16px; }
.csc-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.csc-stat {
  background-color: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.csc-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; opacity: 0.8; }
.csc-stat-value { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; }
.csc-stat-value--accent { font-size: 19px; }
.csc-stat-sub { font-size: 11px; opacity: 0.75; }

/* OpenShiftButton */
.osb-block {
  background-color: var(--wn-bg-elevated);
  border-radius: 16px;
  padding: 24px 20px;
  text-align: center;
}
.osb-content { display: flex; flex-direction: column; align-items: stretch; gap: 12px; }
.osb-title { margin: 0; font-size: 17px; font-weight: 600; color: var(--wn-ink); }
.osb-text { margin: 0; font-size: 13px; line-height: 1.5; color: var(--wn-ink-soft); }
.osb-snapshot {
  background-color: var(--wn-bg);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 4px 0 8px 0;
}
.osb-snapshot-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.osb-snapshot-label { color: var(--wn-ink-mute); }
.osb-snapshot-value { color: var(--wn-ink); font-weight: 500; }
.osb-open {
  background-color: var(--wn-accent);
  color: #fff;
  border: none;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s ease;
}
.osb-open:not(:disabled):active { opacity: 0.85; }
.osb-open:disabled { opacity: 0.5; cursor: not-allowed; }

/* ShiftDetailsModal content */
.sdm-content { padding: 16px 20px 24px 20px; display: flex; flex-direction: column; gap: 12px; }
.sdm-block { display: flex; flex-direction: column; gap: 2px; }
.sdm-block--highlight {
  background-color: var(--wn-accent-fill);
  padding: 12px 14px;
  border-radius: 12px;
  margin: 4px 0;
}
.sdm-row-2 { display: flex; gap: 12px; }
.sdm-row-2 .sdm-block { flex: 1; }
.sdm-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.sdm-value { font-size: 15px; font-weight: 600; color: var(--wn-ink); font-variant-numeric: tabular-nums; }
.sdm-value--big { font-size: 24px; color: var(--wn-accent-text); }
.sdm-sub { font-size: 12px; color: var(--wn-ink-soft); margin-top: 2px; }
.sdm-actions { margin-top: 12px; }
.sdm-delete { width: 100%; border: 1px solid color-mix(in srgb, var(--wn-danger) 30%, transparent); }

/* ==========================================================================
   CategoryChips (chips/chip) — shared by Menu editor + OrderBuilder.
   ========================================================================== */
.chips {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.chips::-webkit-scrollbar { display: none; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid var(--wn-glass-border-subtle);
  background-color: var(--wn-bg-elevated);
  color: var(--wn-ink-soft);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.chip:active { opacity: 0.8; }
.chip--active {
  background-color: var(--wn-accent);
  border-color: var(--wn-accent-text);
  color: #fff;
}
.chip--inactive-cat .chip-text { text-decoration: line-through; opacity: 0.7; }
.chip-dot { font-size: 8px; line-height: 1; color: var(--wn-ink-mute); }
.chip--active .chip-dot { color: rgba(255, 255, 255, 0.8); }
.chip--add { font-size: 18px; padding: 4px 14px; color: var(--wn-accent-text); border-style: dashed; }

/* ==========================================================================
   MenuItemRow (mir-*) — editor mode.
   ========================================================================== */
.mir-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.mir-row:active { background-color: var(--wn-bg-recessed); }
.mir-row--inactive { opacity: 0.55; }
.mir-main { flex: 1; min-width: 0; }
.mir-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-ink);
  margin-bottom: 2px;
}
.mir-badge {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.mir-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--wn-ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mir-portion { flex-shrink: 0; color: var(--wn-ink-faint); }
.mir-description { overflow: hidden; text-overflow: ellipsis; }
.mir-price { font-size: 15px; font-weight: 600; color: var(--wn-accent-text); flex-shrink: 0; }

/* ==========================================================================
   MenuEditorView (menu-*) + form modal helpers (mn-*).
   ========================================================================== */
.menu-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: 80px;
}
.menu-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.menu-title { margin: 0; font-size: 22px; font-weight: 700; color: var(--wn-ink); }
.menu-subtitle {
  font-size: 12px;
  color: var(--wn-ink-mute);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-import-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--wn-ink-soft);
  padding: 4px 8px;
}
.menu-search { margin-bottom: 12px; }
.menu-search-count { font-size: 12px; color: var(--wn-ink-mute); margin: 0 0 8px; }
.menu-cat-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
}
.menu-cat-name { font-size: 15px; font-weight: 600; color: var(--wn-ink); }
.link-btn {
  background: none;
  border: none;
  color: var(--wn-accent-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.menu-items-list { display: flex; flex-direction: column; gap: 6px; }
.menu-empty {
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
}
.menu-empty--full {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
}

/* form modal helpers */
.mn-row { display: flex; gap: 12px; }
.mn-field-price { flex: 1; }
.mn-field-portion { flex: 1; }
.mn-textarea { resize: vertical; min-height: 70px; line-height: 1.45; font-family: inherit; }
.mn-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--wn-ink-soft);
  cursor: pointer;
}

/* ==========================================================================
   OrderHistoryView (oh-*).
   ========================================================================== */
.oh-page { padding: 0 0 24px; max-width: 600px; }
.oh-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  position: sticky;
  top: 0;
  z-index: 10;
}
.oh-title { flex: 1; margin: 0; font-size: 17px; font-weight: 600; color: var(--wn-ink); }
.oh-empty { text-align: center; padding: 60px 24px 32px; }
.oh-empty p { margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: var(--wn-ink); }
.oh-empty-sub {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: var(--wn-ink-mute);
  margin-bottom: 20px !important;
}
.oh-summary { display: flex; gap: 8px; padding: 12px 16px; flex-wrap: wrap; }
.oh-summary-row {
  flex: 1;
  min-width: 100px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--wn-shadow-sm);
}
.oh-summary-label {
  font-size: 11px;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 500;
}
.oh-summary-value { font-size: 16px; font-weight: 700; color: var(--wn-ink); font-variant-numeric: tabular-nums; }
.oh-summary-value--accent { color: var(--wn-mint-ink, #2e7d32); }
.oh-list { list-style: none; margin: 0; padding: 0 16px; display: flex; flex-direction: column; gap: 6px; }
.oh-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--wn-bg-elevated);
  padding: 12px 14px;
  border-radius: 12px;
  cursor: pointer;
}
.oh-row:active { background-color: var(--wn-bg-recessed); }
.oh-row-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.oh-row-main { flex: 1; min-width: 0; }
.oh-row-title { font-size: 14px; font-weight: 600; color: var(--wn-ink); }
.oh-row-hall { color: var(--wn-ink-mute); font-weight: 400; }
.oh-row-meta { font-size: 12px; color: var(--wn-ink-mute); }
.oh-row-amount { font-size: 14px; font-weight: 700; color: var(--wn-ink); font-variant-numeric: tabular-nums; flex-shrink: 0; }

/* ==========================================================================
   OrderDetailsSheet (ods-*).
   ========================================================================== */
.ods-sheet { max-width: 500px; }
.ods-header-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ods-meta { font-size: 12px; color: var(--wn-ink-mute); }
.ods-content { padding: 12px 20px; }
.ods-comments {
  background-color: var(--wn-peach-bg, color-mix(in srgb, var(--wn-warn) 14%, var(--wn-bg-elevated)));
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.ods-comments-label { font-size: 12px; font-weight: 600; color: var(--wn-peach-ink, #c25e1a); }
.ods-comments p { margin: 4px 0 0; font-size: 13px; color: var(--wn-ink-soft); }
.ods-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ods-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.ods-item--served .ods-item-title { opacity: 0.5; text-decoration: line-through; }
.ods-served {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  /* Gray border + subtle fill so the empty checkbox is visible on BOTH
     themes — the glass border is near-white and disappears on light. */
  border: 2px solid var(--wn-ink-faint);
  background: var(--wn-bg-recessed);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.ods-served--on { background-color: var(--wn-accent); border-color: var(--wn-accent); }
.ods-item-main { flex: 1; min-width: 0; }
.ods-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--wn-ink);
}
.ods-item-qty { color: var(--wn-ink-mute); font-variant-numeric: tabular-nums; }
.ods-item-comment { font-size: 12px; color: var(--wn-peach-ink, #c25e1a); font-style: italic; margin-top: 2px; }
.ods-item-price { font-size: 14px; font-weight: 600; color: var(--wn-ink); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.ods-item-remove {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: none;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-mute);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.ods-empty-items { text-align: center; padding: 20px; color: var(--wn-ink-mute); font-size: 13px; }
.ods-tips-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
}
.ods-tips-label { font-size: 14px; color: var(--wn-ink-soft); margin-right: auto; }
.ods-tips-input-wrap { display: flex; align-items: center; gap: 6px; }
.ods-tips-save {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background-color: var(--wn-accent);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.ods-tips-save:disabled { opacity: 0.6; }
.ods-tips-input {
  width: 100px;
  padding: 8px 10px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 8px;
  font-size: 14px;
  text-align: right;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink);
  font-family: inherit;
}
.ods-tips-currency { font-size: 13px; color: var(--wn-ink-mute); }
.ods-totals { margin-top: 14px; border-top: 1px solid var(--wn-glass-border-subtle); padding-top: 12px; }
.ods-totals-row { display: flex; justify-content: space-between; font-size: 14px; color: var(--wn-ink-soft); padding: 2px 0; }
.ods-totals-row--small { font-size: 12px; color: var(--wn-ink-mute); }
.ods-totals-row--main { font-size: 17px; font-weight: 700; color: var(--wn-ink); margin-top: 4px; }
.ods-totals-value { font-variant-numeric: tabular-nums; }
.ods-footer { display: flex; gap: 8px; padding: 12px 20px; }
.ods-footer .btn { flex: 1; padding: 12px; border-radius: 12px; font-weight: 600; }
.ods-footer .btn--ghost { background-color: var(--wn-bg-recessed); color: var(--wn-ink); }
.ods-footer .btn--primary { background-color: var(--wn-accent); color: #fff; }
.ods-footer .btn:disabled { opacity: 0.5; }
.ods-more { display: flex; flex-direction: column; gap: 2px; padding: 0 20px 16px; }
.ods-more-btn {
  background: none;
  border: none;
  padding: 10px;
  font-size: 13px;
  color: var(--wn-ink-mute);
  cursor: pointer;
  font-family: inherit;
  border-radius: 8px;
}
.ods-more-btn:active { background-color: var(--wn-bg-recessed); }
.ods-more-btn--danger { color: var(--wn-danger); }

/* ==========================================================================
   ImportFromCodeView (im-*).
   ========================================================================== */
.im-page { padding: 16px; max-width: 600px; }
.im-section { margin-bottom: 20px; }
.im-hint { font-size: 14px; line-height: 1.5; color: var(--wn-ink-soft); margin: 0 0 14px; }
.im-code-input {
  text-transform: uppercase;
  letter-spacing: 2px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 18px;
  font-weight: 600;
}
.im-btn { width: 100%; margin-top: 12px; padding: 13px; border-radius: 12px; font-weight: 600; }
.im-src-title { font-size: 15px; color: var(--wn-ink); margin: 0 0 8px; }
.im-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.im-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}
.im-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: var(--wn-bg-elevated);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 6px;
  cursor: pointer;
}
.im-row input[type='checkbox'] {
  width: 20px;
  height: 20px;
  accent-color: var(--wn-accent);
  flex-shrink: 0;
}
.im-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.im-row-title { font-size: 15px; font-weight: 500; color: var(--wn-ink); }
.im-row-meta { font-size: 12px; color: var(--wn-ink-mute); }
.im-empty {
  text-align: center;
  padding: 24px;
  color: var(--wn-ink-mute);
  font-size: 14px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
}
.im-footer {
  display: flex;
  gap: 8px;
  position: sticky;
  bottom: 0;
  padding: 12px 0;
  background: linear-gradient(to top, var(--wn-bg) 70%, transparent);
}
.im-footer .btn { padding: 13px 16px; border-radius: 12px; font-weight: 600; }
.im-footer .btn--ghost { background-color: var(--wn-bg-recessed); color: var(--wn-ink); }
.im-footer .btn--primary { background-color: var(--wn-accent); color: #fff; }
.im-btn-grow { flex: 1; }
.im-footer .btn:disabled { opacity: 0.5; }
.im-spinner-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 0;
  color: var(--wn-ink-mute);
}
.im-spinner-row .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--wn-bg-recessed);
  border-top-color: var(--wn-accent);
  border-radius: 50%;
  animation: wn-spin 0.8s linear infinite;
}

/* ==========================================================================
   Map page (map-*) — locked single-screen surface.
   ========================================================================== */
.map-page {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background-color: var(--wn-bg);
}
.map-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px 16px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  touch-action: none;
  overscroll-behavior: contain;
}
.map-header-left { flex: 1; min-width: 0; }
.map-title { margin: 0; font-size: 22px; font-weight: 700; color: var(--wn-ink); }
.map-subtitle { font-size: 12px; color: var(--wn-ink-mute); }
.map-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: color-mix(in srgb, var(--wn-warn) 14%, var(--wn-bg-elevated));
  border-bottom: 1px solid color-mix(in srgb, var(--wn-warn) 32%, var(--wn-bg-elevated));
  padding: 8px 16px;
  font-size: 13px;
  color: color-mix(in srgb, var(--wn-warn) 70%, var(--wn-ink));
}
.map-banner-icon { font-size: 14px; }
.map-banner-text { flex: 1; }
.map-banner-link {
  color: color-mix(in srgb, var(--wn-warn) 70%, var(--wn-ink));
  text-decoration: underline;
  font-weight: 500;
  margin-left: 4px;
}
.map-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
  gap: 12px;
}
.map-canvas-area {
  flex: 1;
  position: relative;
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
}
.map-canvas-area > * {
  position: absolute;
  inset: 0;
  bottom: calc(76px + env(safe-area-inset-bottom));
}

/* ==========================================================================
   HallSwitcher (hsw-*).
   ========================================================================== */
.hsw-switcher {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 4px 16px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.hsw-switcher::-webkit-scrollbar { display: none; }
.hsw-tab {
  flex-shrink: 0;
  /* Recessed fill + visible outline so each hall reads as a real chip,
     not just text floating on empty space. */
  background: var(--wn-bg-recessed);
  border: 1px solid var(--wn-ink-faint);
  padding: 8px 14px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.hsw-tab:active { opacity: 0.8; }
.hsw-tab--active {
  background-color: var(--wn-accent);
  border-color: var(--wn-accent);
  color: #fff;
}

/* ==========================================================================
   HallCanvas (hc-*) — SVG map, table statuses, pulse, zoom controls.
   ========================================================================== */
.hc-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--wn-bg-elevated);
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  overscroll-behavior: contain;
}
/* Override hardcoded SVG stroke/fill attrs from HallCanvas + HallEditorCanvas.
   The canvases set these as attributes so we can't use tokens directly,
   but CSS wins over the presentation attribute. Use the wrapper class
   .hc-wrap as the scope so we don't break unrelated SVGs. */

.hc-wrap svg .hc-bg {
  fill: var(--wn-bg-elevated);
}

.hc-wrap svg defs path[stroke="#eef0f2"] {
  stroke: var(--wn-glass-border-subtle);
}

.hc-wrap svg defs path[stroke="#dde2e7"] {
  stroke: var(--wn-glass-border);
}

.hc-wrap svg > rect[stroke="#cfd8dc"] {
  stroke: var(--wn-glass-border);
}
.hc-canvas { display: block; width: 100%; height: 100%; touch-action: none; }
.hc-bg { cursor: grab; }
.hc-table { cursor: pointer; user-select: none; }
.hc-table-rect {
  fill: var(--wn-bg-elevated);
  stroke: var(--wn-glass-border-subtle);
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.15s ease;
}
.hc-table-num {
  fill: var(--wn-ink-soft);
  font-size: 22px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  pointer-events: none;
}
/* status fills */
.hc-table--free .hc-table-rect { fill: var(--wn-bg-elevated); stroke: var(--wn-glass-border-subtle); }
.hc-table--waiting .hc-table-rect {
  fill: color-mix(in srgb, var(--wn-warn) 22%, var(--wn-bg-elevated));
  stroke: var(--wn-warn);
}
.hc-table--occupied .hc-table-rect {
  fill: color-mix(in srgb, var(--wn-danger) 18%, var(--wn-bg-elevated));
  stroke: var(--wn-danger);
}
.hc-table--reserved .hc-table-rect {
  fill: color-mix(in srgb, var(--wn-sky-ink, #2196f3) 16%, var(--wn-bg-elevated));
  stroke: var(--wn-sky-ink, #2196f3);
}
.hc-table-pulse {
  stroke: var(--wn-accent);
  stroke-width: 3;
  animation: hc-pulse 1.2s ease-out infinite;
  pointer-events: none;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes hc-pulse {
  0% { opacity: 0.9; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.18); }
}
.hc-zoom {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 4px;
  box-shadow: var(--wn-shadow-sm);
}
.hc-zoom-btn {
  width: 40px;
  height: 36px;
  border: none;
  background: none;
  font-size: 20px;
  color: var(--wn-ink);
  cursor: pointer;
  border-radius: 8px;
  font-family: inherit;
}
.hc-zoom-btn:not(:disabled):active { background-color: var(--wn-bg-recessed); }
.hc-zoom-btn:disabled { opacity: 0.35; cursor: default; }
.hc-zoom-btn--reset { font-size: 11px; font-weight: 600; color: var(--wn-ink-mute); }

/* ==========================================================================
   BottomSheet (bs-*) — gesture-driven sheet.
   ========================================================================== */
.bs-overlay {
  position: fixed;
  inset: 0;
  z-index: 250;
  pointer-events: none;
}
.bs-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--wn-bg-elevated);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
  pointer-events: auto;
  will-change: height;
}
.bs-sheet--animating { transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.bs-sheet--dragging { transition: none; }
.bs-handle-area {
  flex-shrink: 0;
  padding: 8px 16px 4px 16px;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.bs-handle-area:active { cursor: grabbing; }
.bs-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background-color: #d0d0d0;
  margin: 0 auto 8px auto;
}
.bs-content { flex: 1; overflow: hidden; padding: 0 16px; }
.bs-content--scrollable { overflow-y: auto; -webkit-overflow-scrolling: touch; }
.bs-footer {
  flex-shrink: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--wn-glass-border-subtle);
  background-color: var(--wn-bg-elevated);
}

/* editor-canvas table affordances + HallFormModal hint */
.hc-table--editable { cursor: pointer; }
.hc-table--selected .hc-table-rect {
  stroke: var(--wn-accent);
  stroke-width: 3;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--wn-accent) 60%, transparent));
}
.hc-table--dragging { cursor: grabbing; }
.hc-table--dragging .hc-table-rect {
  fill: color-mix(in srgb, var(--wn-accent) 16%, var(--wn-bg-elevated));
  stroke: var(--wn-accent);
  stroke-width: 3;
  filter: none;
}
.hf-hint { font-size: 12px; color: var(--wn-ink-mute); margin: 0; }

/* ==========================================================================
   HallEditorView (ed-*).
   ========================================================================== */
.ed-page {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--wn-bg);
  color: var(--wn-ink);
  overflow: hidden;
}
.ed-topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  flex-shrink: 0;
  touch-action: none;
  overscroll-behavior: contain;
}
.ed-title { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
.ed-topbar-actions { display: flex; gap: 4px; }
.ed-icon-btn {
  background: none;
  border: 1px solid var(--wn-glass-border-subtle);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 18px;
  color: var(--wn-ink-soft);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: background-color 0.12s ease;
}
.ed-icon-btn:not(:disabled):active { background-color: var(--wn-bg-recessed); }
.ed-icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ed-halls-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
  flex-shrink: 0;
}
.ed-halls-tabs {
  flex: 1;
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  touch-action: pan-x;
}
.ed-halls-tabs::-webkit-scrollbar { display: none; }
.ed-hall-tab {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 8px 14px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.ed-hall-tab--active { background-color: var(--wn-accent); color: #fff; }
.ed-hall-tab--add { color: var(--wn-accent); border: 1px dashed var(--wn-glass-border-subtle); }
.ed-hall-edit-btn {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--wn-glass-border-subtle);
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ed-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 32px 24px;
}
.ed-canvas-area { flex: 1; position: relative; overflow: hidden; }
.ed-canvas-area > .hc-wrap { position: absolute; inset: 0; }

/* ==========================================================================
   TableEditPanel (tep-*).
   ========================================================================== */
.tep-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}
.tep-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--wn-ink);
  display: flex;
  align-items: center;
  gap: 6px;
}
.tep-num-input {
  width: 60px;
  font-size: 16px;
  font-weight: 600;
  color: var(--wn-ink);
  padding: 4px 8px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 8px;
  background-color: var(--wn-bg-recessed);
  outline: none;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
}
.tep-num-input::-webkit-outer-spin-button,
.tep-num-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.tep-num-input:focus { border-color: var(--wn-accent); background-color: var(--wn-bg-elevated); }
.tep-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: var(--wn-ink-mute);
  cursor: pointer;
  padding: 4px 8px;
}
.tep-form { padding: 8px 4px 16px 4px; display: flex; flex-direction: column; gap: 18px; }
.tep-field { display: flex; flex-direction: column; gap: 8px; }
.tep-field-row { display: flex; align-items: center; justify-content: space-between; }
.tep-label { font-size: 14px; color: var(--wn-ink-soft); }
.tep-value { font-size: 13px; color: var(--wn-ink-mute); font-variant-numeric: tabular-nums; }
.tep-slider { width: 100%; accent-color: var(--wn-accent); }
.tep-presets { display: flex; gap: 8px; }
.tep-preset {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  background: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--wn-ink-soft);
  cursor: pointer;
}
.tep-preset--active { border-color: var(--wn-accent); color: var(--wn-accent); background-color: color-mix(in srgb, var(--wn-accent) 8%, transparent); }
.tep-preset-icon {
  width: 28px;
  height: 28px;
  background-color: var(--wn-ink-mute);
  display: block;
}
.tep-preset--active .tep-preset-icon { background-color: var(--wn-accent); }
.tep-reset-link {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--wn-accent);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  padding: 2px 0;
}
.tep-footer { display: flex; gap: 8px; }
.tep-footer .btn { flex: 1; padding: 11px; border-radius: 10px; font-weight: 600; font-size: 14px; }
.tep-footer .btn--danger { background-color: color-mix(in srgb, var(--wn-danger) 14%, transparent); color: var(--wn-danger); }
.tep-footer .btn--ghost { background-color: var(--wn-bg-recessed); color: var(--wn-ink); }
.tep-footer .btn--primary { background-color: var(--wn-accent); color: #fff; }

/* ==========================================================================
   HallLayoutsPanel (hlp-*).
   ========================================================================== */
.hlp-header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
.hlp-title { margin: 0; font-size: 17px; font-weight: 600; color: var(--wn-ink); }
.hlp-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: var(--wn-ink-mute);
  cursor: pointer;
  padding: 4px 8px;
}
.hlp-body { padding: 12px 4px 24px 4px; display: flex; flex-direction: column; gap: 12px; }
.hlp-action {
  width: 100%;
  padding: 12px 16px;
  border: 1px dashed var(--wn-accent);
  border-radius: 12px;
  background-color: color-mix(in srgb, var(--wn-accent) 6%, var(--wn-bg-elevated));
  color: var(--wn-accent);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
}
.hlp-action:disabled { opacity: 0.5; cursor: not-allowed; }
.hlp-empty {
  margin: 8px 4px;
  padding: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--wn-ink-mute);
  background-color: var(--wn-bg-recessed);
  border-radius: 10px;
  text-align: center;
}
.hlp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.hlp-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 12px;
}
.hlp-info { flex: 1; min-width: 0; }
.hlp-name { font-size: 14px; font-weight: 600; color: var(--wn-ink); }
.hlp-meta { font-size: 12px; color: var(--wn-ink-mute); margin-top: 2px; }
.hlp-actions { display: flex; align-items: center; gap: 4px; }
.hlp-apply {
  background-color: var(--wn-accent);
  color: #fff;
  border: none;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.hlp-apply:disabled { opacity: 0.5; }
.hlp-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}
.hlp-icon--danger { filter: grayscale(0.2); }
.hlp-icon:disabled { opacity: 0.4; }

/* ==========================================================================
   OrderBuilder (ob-*) + MenuPickRow (mpr-*) + CartContent (cc-*) +
   TablePickerSheet (tps-*).
   ========================================================================== */
.ob-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background-color: var(--wn-bg);
  padding-bottom: 0px; /* will be env(safe-area-inset-bottom) when inside sheet */
}
.ob-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--wn-bg-elevated);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.ob-title { flex: 1; margin: 0; font-size: 17px; font-weight: 600; color: var(--wn-ink); }
.ob-clear-btn {
  background: none;
  border: none;
  color: var(--wn-danger);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  padding: 4px 8px;
}
.ob-items { display: flex; flex-direction: column; gap: 8px; padding: 8px 16px; }
.ob-search-results { padding: 8px 0; }
.ob-search-count { font-size: 12px; color: var(--wn-ink-mute); padding: 0 16px 8px; margin: 0; }
.ob-empty { text-align: center; padding: 32px 16px; color: var(--wn-ink-mute); }
.ob-empty--small { padding: 20px; font-size: 13px; }
.ob-empty--centered { padding: 48px 24px; }
.ob-empty .btn-link {
  background: none;
  border: none;
  color: var(--wn-accent-text);
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  margin-top: 8px;
}

/* cart sheet header */
.ob-cart-header { cursor: pointer; padding: 0 4px; }
.ob-cart-summary { display: flex; align-items: center; justify-content: space-between; }
.ob-cart-count { font-size: 14px; color: var(--wn-ink-soft); }
.ob-cart-total {
  font-size: 18px;
  font-weight: 700;
  color: var(--wn-ink);
  font-variant-numeric: tabular-nums;
}
.ob-table-plate {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  background-color: var(--wn-bg-recessed);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
}
.ob-table-plate--readonly { cursor: default; }
.ob-table-plate-icon { font-size: 16px; }
.ob-table-plate-text { flex: 1; font-size: 14px; color: var(--wn-ink); }
.ob-table-plate-text small { color: var(--wn-ink-mute); font-size: 12px; }
.ob-table-plate-text--empty { color: var(--wn-ink-mute); }
.ob-table-plate-edit { font-size: 13px; opacity: 0.6; }
.ob-order-comment { margin-top: 12px; padding: 0 4px; }
.ob-order-comment-label { display: block; font-size: 12px; color: var(--wn-ink-mute); margin-bottom: 4px; }
.ob-order-comment-btn {
  width: 100%;
  padding: 10px 12px;
  background-color: var(--wn-bg-recessed);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  color: var(--wn-ink);
  text-align: left;
  cursor: pointer;
}
.ob-order-comment-btn--empty { color: var(--wn-accent-text); }
.ob-order-comment-text { white-space: pre-wrap; word-break: break-word; }
.ob-submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background-color: var(--wn-accent);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.ob-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* MenuPickRow */
.mpr-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background-color: var(--wn-bg-elevated);
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.mpr-row:active { background-color: var(--wn-bg-recessed); transform: scale(0.99); }
.mpr-row--in-cart { border-color: var(--wn-accent); background-color: var(--wn-accent-fill); }
.mpr-main { flex: 1; min-width: 0; }
.mpr-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-ink);
  margin-bottom: 2px;
}
.mpr-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  background-color: var(--wn-accent);
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.mpr-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--wn-ink-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mpr-portion { flex-shrink: 0; color: var(--wn-ink-faint); }
.mpr-desc { overflow: hidden; text-overflow: ellipsis; }
.mpr-price {
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-accent-text);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* CartContent */
.cc-cart { display: flex; flex-direction: column; }
.cc-empty { text-align: center; padding: 40px 16px; color: var(--wn-ink-mute); }
.cc-empty p { margin: 0; font-size: 14px; }
.cc-empty-sub { margin-top: 4px !important; font-size: 12px; color: var(--wn-ink-faint); }
.cc-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.cc-item { display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--wn-glass-border-subtle); }
.cc-item:last-child { border-bottom: none; }
.cc-item-main { flex: 1; min-width: 0; }
.cc-item-title-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px; }
.cc-item-title { font-size: 14px; font-weight: 600; color: var(--wn-ink); line-height: 1.3; }
.cc-item-price { font-size: 14px; font-weight: 600; color: var(--wn-ink); font-variant-numeric: tabular-nums; flex-shrink: 0; }
.cc-item-meta { font-size: 11px; color: var(--wn-ink-mute); margin-bottom: 4px; }
.cc-item-unit { font-variant-numeric: tabular-nums; }
.cc-item-comment-row { margin-top: 4px; }
.cc-add-comment {
  background: none;
  border: none;
  color: var(--wn-accent-text);
  font-size: 12px;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}
.cc-comment-display {
  background: var(--wn-bg-recessed);
  border: none;
  color: var(--wn-ink-soft);
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-item-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; align-self: flex-start; margin-top: 2px; }
.cc-qty-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--wn-glass-border-subtle);
  background-color: var(--wn-bg-elevated);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  font-family: inherit;
  color: var(--wn-ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cc-qty-btn:active { background-color: var(--wn-bg-recessed); }
.cc-qty { font-size: 14px; font-weight: 600; color: var(--wn-ink); min-width: 18px; text-align: center; font-variant-numeric: tabular-nums; }

/* TablePickerSheet */
.tps-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 260;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.tps-sheet {
  background-color: var(--wn-bg-elevated);
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom);
}
.tps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.tps-title { margin: 0; font-size: 17px; font-weight: 600; }
.tps-close { background: none; border: none; font-size: 24px; line-height: 1; color: var(--wn-ink-mute); cursor: pointer; padding: 4px 8px; }
.tps-halls-tabs { display: flex; gap: 6px; padding: 8px 16px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--wn-glass-border-subtle); }
.tps-halls-tabs::-webkit-scrollbar { display: none; }
.tps-hall-tab {
  flex-shrink: 0;
  background: none;
  border: 1px solid var(--wn-glass-border-subtle);
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
}
.tps-hall-tab--active { background-color: var(--wn-accent); border-color: var(--wn-accent); color: #fff; }
.tps-map-wrap { flex: 1; padding: 12px 16px; min-height: 280px; display: flex; align-items: center; justify-content: center; }
.tps-map { width: 100%; max-height: 380px; display: block; }
.tps-empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--wn-ink-mute); padding: 40px 20px; }
.tps-bg { fill: var(--wn-bg); stroke: var(--wn-glass-border-subtle); }
.tps-table { cursor: pointer; }
.tps-table-rect { stroke-width: 2; transition: fill 0.15s ease, stroke 0.15s ease; }
.tps-table-num { font-size: 20px; font-weight: 600; pointer-events: none; }
.tps-table--free .tps-table-rect { fill: var(--wn-bg-elevated); stroke: var(--wn-glass-border-subtle); }
.tps-table--free .tps-table-num { fill: var(--wn-ink-soft); }
.tps-table--waiting .tps-table-rect {
  fill: color-mix(in srgb, var(--wn-accent) 16%, var(--wn-bg-elevated));
  stroke: var(--wn-accent);
  stroke-width: 2.5;
}
.tps-table--waiting .tps-table-num { fill: var(--wn-accent-text); }
.tps-table--occupied .tps-table-rect {
  fill: color-mix(in srgb, var(--wn-danger) 16%, var(--wn-bg-elevated));
  stroke: var(--wn-danger);
  stroke-width: 2.5;
}
.tps-table--occupied .tps-table-num { fill: var(--wn-danger); }
.tps-table--reserved .tps-table-rect { fill: color-mix(in srgb, #42a5f5 15%, var(--wn-bg-elevated)); stroke: #42a5f5; }
.tps-table--reserved .tps-table-num { fill: #1565c0; }
.tps-table--current .tps-table-rect {
  stroke: var(--wn-accent);
  stroke-width: 4;
  fill: color-mix(in srgb, var(--wn-accent) 22%, var(--wn-bg-elevated));
}
.tps-table--current .tps-table-num { fill: var(--wn-accent-text); }
.tps-table--blocked { cursor: not-allowed; opacity: 0.5; }
.tps-legend { display: flex; gap: 14px; padding: 8px 16px; font-size: 11px; color: var(--wn-ink-mute); flex-wrap: wrap; }
.tps-legend-item { display: flex; align-items: center; gap: 4px; }
.tps-legend-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.tps-legend-dot--free { background-color: var(--wn-bg-elevated); border: 1.5px solid var(--wn-glass-border-subtle); }
.tps-legend-dot--waiting { background-color: color-mix(in srgb, var(--wn-accent) 22%, var(--wn-bg-elevated)); border: 1.5px solid var(--wn-accent); }
.tps-legend-dot--occupied { background-color: color-mix(in srgb, var(--wn-danger) 22%, var(--wn-bg-elevated)); border: 1.5px solid var(--wn-danger); }
.tps-legend-dot--reserved { background-color: color-mix(in srgb, #42a5f5 18%, var(--wn-bg-elevated)); border: 1.5px solid #42a5f5; }
.tps-footer { padding: 12px 16px; border-top: 1px solid var(--wn-glass-border-subtle); }
.tps-footer .btn { width: 100%; padding: 12px 16px; border-radius: 10px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
.tps-footer .btn--ghost { background-color: var(--wn-bg); color: var(--wn-ink-soft); }

/* ==========================================================================
   MenuTwoPanel (mtp-*) — vertical category rail + items pane.
   Used by MenuEditorView and OrderBuilderView. Two-panel idiom replaces
   the horizontal chip strip on screens that support it.
   ========================================================================== */

.mtp-wrap {
  display: flex;
  gap: 8px;
  /* Fill available vertical space without growing past it — the parent
     pages already constrain height (.app-content scrolls). We give the
     wrap a min-height so the rail's scroll behavior actually kicks in
     when there are many categories. */
  min-height: 360px;
  /* On the order builder, the cart sheet covers the bottom — leave room
     so the last item isn't permanently hidden behind it. Editor sets
     padding-bottom on .menu-page so this is enough on both screens. */
}

/* LEFT — vertical category rail */
.mtp-rail {
  flex: 0 0 116px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Independent scroll so categories don't push the right pane down on
     narrow phones with very long lists. */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 2px 0 12px 0;
}
.mtp-rail::-webkit-scrollbar { display: none; }

.mtp-cat {
  /* Tap target: at least 44px tall for thumb-friendly tapping. */
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  background: none;
  border-radius: 10px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--wn-ink-soft);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  /* Long names wrap to two lines instead of overflowing the narrow rail. */
  white-space: normal;
  line-height: 1.3;
  word-break: break-word;
}
.mtp-cat:active { background-color: var(--wn-bg-recessed); }

.mtp-cat--active {
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  font-weight: 600;
}

.mtp-cat--inactive .mtp-cat-text {
  text-decoration: line-through;
  opacity: 0.65;
}

.mtp-cat-dot {
  flex-shrink: 0;
  font-size: 7px;
  color: var(--wn-ink-mute);
  line-height: 1;
}

.mtp-cat--add {
  /* Plus button at the end of the rail in editor mode. Dashed border
     hints "add slot" without competing with real categories. */
  border: 1px dashed var(--wn-glass-border);
  color: var(--wn-accent-text);
  margin-top: 4px;
  justify-content: center;
  font-size: 12px;
}
.mtp-cat--add:active { background-color: var(--wn-bg-recessed); }

/* RIGHT — items pane */
.mtp-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* Items area scrolls independently so category-tab swaps don't reset
     the rail's scroll position. */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mtp-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mtp-empty {
  background-color: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
}
/* ==========================================================================
   ProfileView hero (pf-avatar, pf-hero*) — avatar + display name + handle.
   Replaces the old "tg-id-row" card. The .tg-id-* classes can stay in the
   CSS file (no harm) or be removed later — nothing else references them.
   ========================================================================== */

/* Hero block (avatar + name + handle row) — sits right under .pf-title. */
.pf-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.pf-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  /* Border ensures contrast on accent-fill in dark theme when the fill
     is nearly invisible. */
  border: 1px solid color-mix(in srgb, var(--wn-accent) 20%, transparent);
}

.pf-hero-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pf-hero-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--wn-ink);
  /* Long names truncate so the layout doesn't break on absurd inputs. */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pf-hero-handle-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pf-hero-handle {
  font-size: 13px;
  color: var(--wn-ink-mute);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf-hero-handle--mono {
  /* Monospaced when showing the numeric tg_id — keeps the dots/digits
     aligned and reads as a "code" rather than a name. */
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  letter-spacing: 0.5px;
}
.pf-hero-handle--muted {
  font-style: italic;
  opacity: 0.7;
}

.pf-hero-icon-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px 6px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  color: var(--wn-ink-mute);
  transition: background-color 0.15s ease;
}
.pf-hero-icon-btn:active {
  background-color: var(--wn-bg-recessed);
}

/* Title spacing — was bound to the old grid header; now standalone. */
.pf-header {
  margin-bottom: 24px;
}
.pf-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: var(--wn-ink);
}

/* ==========================================================================
   ProfileView v2 — full design refresh matching the design reference.
   New blocks (hero + card groups + section labels) coexist with the
   existing AppearanceView classes (.perso-card, .swatches, .seg-btn) so
   the inline appearance picker just works without changes.

   Add this whole block to the END of src/styles/global.css.
   Old classes (.tg-id-*, .action-row, .card--current) stay untouched —
   leave them or strip later, they no longer render in the new profile.
   ========================================================================== */

/* ---------- Hero ---------- */

.pf-header {
  margin-bottom: 24px;
}
.pf-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: var(--wn-ink);
}

.pf-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 4px;
}

.pf-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  /* Subtle border ensures contrast when accent-fill is very light on
     light bg or very dark on dark bg. */
  border: 1px solid color-mix(in srgb, var(--wn-accent) 20%, transparent);
}

.pf-hero-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.pf-hero-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf-hero-handle-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.pf-hero-handle {
  font-size: 13px;
  color: var(--wn-ink-mute);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pf-hero-handle--mono {
  /* Monospaced when showing the numeric tg_id — keeps dots and digits
     aligned. Reads as a "code" rather than a name. */
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  letter-spacing: 0.5px;
}
.pf-hero-handle--muted {
  font-style: italic;
  opacity: 0.7;
}
.pf-hero-icon-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 4px 6px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  border-radius: 6px;
  color: var(--wn-ink-mute);
  transition: background-color 0.15s ease;
}
.pf-hero-icon-btn:active {
  background-color: var(--wn-bg-recessed);
}

/* ---------- Section label (uppercase header above each card group) ---------- */

.pf-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--wn-ink-mute);
  margin: 20px 4px 8px;
  /* First label sits closer to the hero (no top margin). */
}
.pf-hero + .pf-section-label,
.pf-header + .pf-section-label {
  margin-top: 18px;
}

/* ---------- Card group (rounded card with rows + dividers) ---------- */

.pf-card-group {
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 14px;
  overflow: hidden;
  /* The card itself doesn't have inner padding — rows handle their own
     padding so the dividers can stretch nearly edge-to-edge. */
}
.pf-card-group--spaced {
  margin-top: 18px;
}

.pf-card-divider {
  height: 1px;
  background-color: var(--wn-glass-border-subtle);
  /* Stop the divider short of the card edges so it visually aligns with
     the start of the row text (icon ends ~46px in). */
  margin: 0 14px;
}

/* ---------- Row inside a card group ---------- */

.pf-row {
  /* Reset button defaults so it reads as a tappable list row, not a
     bordered button. */
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 56px;
  padding: 12px 14px;
  background: none;
  border: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  color: var(--wn-ink);
  transition: background-color 0.15s ease;
}
.pf-row:active {
  background-color: var(--wn-bg-recessed);
}

.pf-row-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--wn-ink-soft);
}
.pf-row-icon svg {
  display: block;
}

.pf-row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  /* Body sits in a row by default — title left, meta right (like
     "Кофейня «Зерно» · Текущее" with "Текущее" on the right). When meta
     wraps under the title (long name + long meta), it falls below
     gracefully via the flex-wrap below. */
  flex-wrap: wrap;
}
.pf-row-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Title takes priority — meta will shrink first. */
  flex-shrink: 0;
}
.pf-row-meta {
  font-size: 13px;
  color: var(--wn-ink-mute);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.pf-row-chev {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  color: var(--wn-ink-faint);
}
.pf-row-chev svg {
  display: block;
}

/* Danger variant for "Выйти" — red title, no chevron (rendered out by JSX). */
.pf-row--danger .pf-row-icon,
.pf-row--danger .pf-row-title {
  color: var(--wn-danger);
}

/* ---------- Inline appearance picker spacing ---------- */

/* The .perso-card / .perso-block / .swatch / .seg-btn classes already
   exist in global.css from AppearanceView — we reuse them as-is. Just
   make sure the spacing above it matches a section-label gap. */
.pf-section-label + .perso-card {
  margin-bottom: 0;
}

/* ==========================================================================
   Avatar image (Telegram photo) inside .pf-avatar.
   Append to global.css after the .pf-avatar block.
   ========================================================================== */

.pf-avatar-img {
  /* Fill the parent circle exactly — preserve aspect, crop center. */
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  /* Avoid the broken-image alt-text glyph if the URL is reachable but
     the image is empty (rare Telegram edge case). */
  display: block;
}

/* Hide the avatar's inner border on photo mode — it competes visually
   with the round photo edge. (Border is fine for the initial fallback,
   where the accent-fill background is flat.) */
.pf-avatar:has(.pf-avatar-img) {
  border-color: transparent;
}

/* ==========================================================================
   MenuItemRow (mir-*) — universal row: edit + pick mode.
   Designed June 2026 from menu redesign mockups. Layout:
       [ⓘ] Title (badges)        portion (mute, 12px)
                                 price (bold, accent, 15px)
   ⓘ button on the left is pick-mode only.
   Replaces the previous .mir-row + .mpr-row split — both now share one
   stylesheet block, with .mir-row--in-cart for the cart-count state.
   ========================================================================== */

.mir-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 12px 14px;
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  /* The row is a <div>, not a button, because we have a nested ⓘ button
     in pick mode and nested buttons are invalid. Tap target is governed
     by min-height + padding (>=44px) so this is still accessible. */
}
.mir-row:active {
  background-color: var(--wn-bg-recessed);
}

/* In-cart highlight — subtle, doesn't compete with active chip color.
   Wins over the base border so the row stands out a bit. */
.mir-row--in-cart {
  border-color: var(--wn-accent-soft);
  background-color: var(--wn-accent-fill);
}

/* Hidden item (edit mode only — pick mode pre-filters these out). */
.mir-row--hidden {
  opacity: 0.55;
}

/* ⓘ button — pick mode only. -4px left margin lets the icon visually
   sit at the row edge while keeping a generous 32×32 tap target. */
.mir-info-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-left: -4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wn-ink-mute);
  border-radius: 8px;
  transition: background-color 0.15s ease, color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.mir-info-btn:active {
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-soft);
}
.mir-info-btn svg {
  display: block;
}

/* Center column — title + optional badges (skрыто, ×N qty). */
.mir-title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.mir-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--wn-ink);
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* "скрыто" pill in edit mode for is_active=false items. */
.mir-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--wn-bg-recessed);
  color: var(--wn-ink-mute);
}

/* "×N" qty badge in pick mode when this item is already in the cart. */
.mir-qty {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--wn-accent-text);
  background-color: var(--wn-accent-fill);
  border-radius: 6px;
  padding: 2px 6px;
}

/* Right column — portion (top, mute) + price (bottom, bold accent). */
.mir-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 1px;
  flex-shrink: 0;
}
/* Without portion, the price sits vertically centered on its own — no
   stacking modifier needed. With portion, --stacked gives a hair of
   extra gap so price doesn't kiss the portion label. */
.mir-right--stacked {
  gap: 2px;
}

.mir-portion {
  font-size: 12px;
  color: var(--wn-ink-mute);
  white-space: nowrap;
}
.mir-price {
  font-size: 15px;
  font-weight: 600;
  color: var(--wn-accent-text);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* ==========================================================================
   Category header — sits under chips in MenuEditorView.
   Replaces the smaller .menu-cat-actions row. Per designer mockup it's a
   proper H2 with right-aligned "Изменить" link.
   ========================================================================== */
.cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 12px;
}
.cat-header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--wn-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
/* ==========================================================================
   MenuTwoPanel (mtp-*) — vertical category rail + content pane.
   Per designer mockup (June 2026): rail uses bg-elevated with a right
   border so it looks like a distinct sidebar; pane scrolls independently.
   ========================================================================== */

.mtp-wrap {
  /* Fill remaining vertical space of the page. The parent (.menu-page or
     .ob-page) is already a flex column, so flex:1 here works. */
  flex: 1;
  display: flex;
  min-height: 0;
  /* Tuck the rail to the page edges visually — the .page wrapper adds
     16px padding on both sides; counteract it so the rail kisses the
     screen edge (matches the designer mockup). Pane content keeps its
     own inner padding so text doesn't touch the rail border. */
  margin: 0 -16px;
}

/* LEFT — category rail. */
.mtp-rail {
  flex: 0 0 116px;
  background-color: var(--wn-bg-elevated);
  border-right: 1px solid var(--wn-glass-border-subtle);
  padding: 10px 8px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mtp-rail::-webkit-scrollbar { display: none; }

.mtp-cat {
  /* Tap target: at least 44px tall thanks to 11+22(line)+11 padding. */
  display: block;
  width: 100%;
  text-align: left;
  padding: 11px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--wn-ink-soft);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  /* Long names wrap to two lines inside the narrow rail rather than
     getting truncated — keeps the user oriented. */
  white-space: normal;
  word-break: break-word;
  transition: background-color 0.15s ease, color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
  /* Dot for inactive categories sits inline with the title text. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.mtp-cat:active {
  background-color: var(--wn-bg-recessed);
}

.mtp-cat--active {
  background-color: var(--wn-accent-fill);
  color: var(--wn-accent-text);
  font-weight: 600;
}

.mtp-cat--inactive .mtp-cat-text {
  text-decoration: line-through;
  opacity: 0.65;
}

.mtp-cat-text {
  flex: 1;
  min-width: 0;
}

.mtp-cat-dot {
  flex-shrink: 0;
  font-size: 7px;
  color: var(--wn-ink-mute);
  line-height: 1;
}

/* "+ Категория" — distinct from regular cats: dashed border, centered,
   slightly indented vertically (margin-top) to separate from the list. */
.mtp-cat-add {
  display: block;
  width: 100%;
  margin-top: 6px;
  padding: 9px 10px;
  border: 1px dashed var(--wn-glass-border);
  border-radius: 10px;
  background: transparent;
  color: var(--wn-accent-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  transition: background-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.mtp-cat-add:active {
  background-color: var(--wn-bg-recessed);
}

/* RIGHT — content pane. Scrolls independently of the rail. */
.mtp-pane {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 12px 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mtp-pane::-webkit-scrollbar { display: none; }

.mtp-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mtp-empty {
  background-color: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
}
WN_TOOLS_EOF

# ---- src/styles/tools.css ----
cat > "src/styles/tools.css" <<'WN_TOOLS_EOF'
/* Tools landing — each tool is its own larger, separate card. */

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tool-card {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 18px;
  padding: 20px 18px;
  box-shadow: var(--wn-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
  transition: transform 0.08s ease, box-shadow 0.15s ease;
}
.tool-card:active {
  transform: scale(0.985);
}

.tool-card-icon {
  flex: 0 0 auto;
  width: 54px;
  height: 54px;
  border-radius: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--wn-ink);
}
.tool-card-icon--sky {
  background: var(--wn-sky-bg);
  color: var(--wn-sky-ink);
}
.tool-card-icon--peach {
  background: var(--wn-peach-bg);
  color: var(--wn-peach-ink);
}
.tool-card-icon--lavender {
  background: var(--wn-lavender-bg);
  color: var(--wn-lavender-ink);
}

.tool-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tool-card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--wn-ink);
}
.tool-card-meta {
  font-size: 14px;
  color: var(--wn-ink-mute);
}

.tool-card-chev {
  flex: 0 0 auto;
  color: var(--wn-ink-faint);
  display: inline-flex;
}
WN_TOOLS_EOF

# ---- src/styles/calculator.css ----
cat > "src/styles/calculator.css" <<'WN_TOOLS_EOF'
/* ==========================================================================
   Calculator (Инструменты → Калькулятор) — full-screen layout.
   Imported by src/views/tools/CalculatorView.jsx.
   ========================================================================== */

/* Fill the available height (above the bottom nav); keypad grows to fill. */
.calc-page--full {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.calc-header {
  margin-bottom: 12px;
}

.calc-history-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg-elevated);
  color: var(--wn-ink);
  cursor: pointer;
  /* Stay above the history overlay so it can act as the close button. */
  position: relative;
  z-index: 1100;
}

/* When history is open the button becomes a red close (×). */
.calc-history-btn--close {
  background: var(--wn-rose-ink, #c62828);
  border-color: var(--wn-rose-ink, #c62828);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  font-weight: 600;
}

.calc {
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
}

.calc--full {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.calc-display {
  background: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 16px;
  padding: 22px 18px;
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 14px;
  overflow-x: auto;
}

.calc-expr {
  font-size: 40px;
  font-weight: 600;
  color: var(--wn-ink);
  line-height: 1.1;
  white-space: nowrap;
}

.calc-keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

/* In full-screen mode the keypad stretches to fill the remaining height. */
.calc--full .calc-keys {
  flex: 1 1 auto;
  min-height: 0;
  grid-template-rows: repeat(5, 1fr);
}

.calc-key {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg-elevated);
  color: var(--wn-ink);
  font-size: 24px;
  font-weight: 500;
  min-height: 56px;
  height: 100%;
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.05s ease, background 0.15s ease, filter 0.15s ease;
  user-select: none;
}

.calc-key:active {
  transform: scale(0.96);
  filter: brightness(0.97);
}

.calc-key--fn {
  background: var(--wn-bg-recessed);
  color: var(--wn-ink-soft);
}

.calc-key--op {
  background: var(--wn-accent-bg);
  color: var(--wn-accent-ink);
  font-weight: 700;
}

.calc-key--equals {
  grid-row: span 2;
  background: var(--wn-accent);
  color: #fff;
  font-weight: 700;
}

.calc-key--zero {
  grid-column: span 2;
}

/* ── History centered modal ── */
.calc-hist-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.calc-hist-modal {
  width: 100%;
  max-width: 460px;
  max-height: 70vh;
  background: var(--wn-bg-elevated);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.calc-hist-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex: 0 0 auto;
}

.calc-history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.calc-history-clear {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  color: var(--wn-accent-ink);
  font-size: 14px;
  cursor: pointer;
  padding: 4px 6px;
}

.calc-history-empty {
  color: var(--wn-ink-faint);
  font-size: 14px;
  padding: 12px 2px;
  text-align: center;
}

.calc-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
}

.calc-history-item {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg-elevated);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.calc-history-expr {
  color: var(--wn-ink-soft);
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calc-history-eq {
  color: var(--wn-ink);
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
}
WN_TOOLS_EOF

# ---- src/styles/reminders.css ----
cat > "src/styles/reminders.css" <<'WN_TOOLS_EOF'
/* ==========================================================================
   Reminders (Инструменты → Напоминания)
   Imported by src/views/tools/RemindersView.jsx.
   ========================================================================== */

.rm-seg {
  margin-bottom: 18px;
}

.rm-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rm-group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wn-ink-mute);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 8px 4px;
}
.rm-group-title--danger {
  color: var(--wn-rose-ink, #c62828);
}

.rm-card {
  background: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 16px;
  padding: 4px 14px;
}

.rm-divider {
  height: 1px;
  background: var(--wn-glass-border-subtle);
}

.rm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
}

.rm-check {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--wn-ink-faint);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.rm-check--on {
  background: var(--wn-accent);
  border-color: var(--wn-accent);
}

.rm-item-body {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  text-align: left;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.rm-item-text {
  font-size: 16px;
  color: var(--wn-ink);
  line-height: 1.25;
}
.rm-item--done .rm-item-text {
  text-decoration: line-through;
  color: var(--wn-ink-mute);
}

.rm-item-time {
  font-size: 13px;
  color: var(--wn-ink-mute);
}
.rm-lead {
  color: var(--wn-ink-faint);
}

/* ── Calendar ── */
.rm-cal-wrap {
  display: flex;
  flex-direction: column;
}
.rm-cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.rm-cal-month {
  font-size: 17px;
  font-weight: 700;
  color: var(--wn-ink);
}
.rm-cal-nav {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg-elevated);
  color: var(--wn-ink);
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.rm-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.rm-cal-weekdays {
  margin-bottom: 6px;
}
.rm-cal-wd {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--wn-ink-faint);
  padding: 2px 0;
}
.rm-cal-day {
  -webkit-appearance: none;
  appearance: none;
  position: relative;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg-elevated);
  color: var(--wn-ink);
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rm-cal-day--today {
  border-color: var(--wn-accent);
  color: var(--wn-accent-ink);
  font-weight: 700;
}
.rm-cal-day--sel {
  background: var(--wn-accent);
  border-color: var(--wn-accent);
  color: #fff;
  font-weight: 700;
}
.rm-cal-dot {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--wn-peach-ink);
}
.rm-cal-day--sel .rm-cal-dot {
  background: #fff;
}
.rm-cal-wrap .rm-group-title {
  margin-top: 20px;
}

.rm-empty {
  color: var(--wn-ink-faint);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

/* ── Day agenda (reminders by time) ── */
.rm-agenda {
  display: flex;
  flex-direction: column;
}
.rm-slot {
  display: grid;
  grid-template-columns: 52px 8px 1fr;
  align-items: stretch;
  gap: 10px;
  min-height: 56px;
}
.rm-slot-time {
  font-size: 14px;
  font-weight: 700;
  color: var(--wn-ink-soft);
  padding-top: 16px;
  text-align: right;
}
.rm-slot-line {
  position: relative;
  width: 3px;
  justify-self: center;
  border-radius: 2px;
  margin: 6px 0;
  background: var(--wn-accent);
}
.rm-slot-line::before {
  content: '';
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: inherit;
  border: 2px solid var(--wn-bg-elevated);
}
.rm-slot-card {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  text-align: left;
  background: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 14px;
  padding: 12px 14px;
  margin-bottom: 10px;
  cursor: pointer;
}
.rm-slot-card--done .rm-item-text {
  text-decoration: line-through;
  color: var(--wn-ink-mute);
}

/* ── New/edit reminder modal ── */
.rm-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.rm-modal {
  width: 100%;
  max-width: 440px;
  background: var(--wn-bg-elevated);
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rm-modal-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--wn-ink);
  margin: 0;
}
.rm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.rm-field-row {
  display: flex;
  gap: 12px;
}
.rm-field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--wn-ink-mute);
}
.rm-input {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  color: var(--wn-ink);
  width: 100%;
  box-sizing: border-box;
}
.rm-lead-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rm-chip {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg);
  color: var(--wn-ink-soft);
  border-radius: 10px;
  padding: 7px 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.rm-chip--on {
  background: var(--wn-accent-bg);
  color: var(--wn-accent-ink);
  border-color: var(--wn-accent);
}
.rm-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}
.rm-btn {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  border-radius: 12px;
  padding: 13px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.rm-btn--ghost {
  background: var(--wn-bg-recessed);
  color: var(--wn-ink);
}
.rm-btn--primary {
  background: var(--wn-accent);
  color: #fff;
}
.rm-btn--danger {
  background: var(--wn-rose-bg, #fde8e8);
  color: var(--wn-rose-ink, #c62828);
}

/* 24-hour time selectors (hours : minutes) */
.rm-time {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rm-select {
  width: auto;
  flex: 1;
  text-align: center;
  text-align-last: center;
}
.rm-time-colon {
  font-size: 20px;
  font-weight: 700;
  color: var(--wn-ink);
}

/* Vertical gray separator between the check circle and the task text */
.rm-item-sep {
  flex: 0 0 auto;
  align-self: stretch;
  width: 1px;
  background: var(--wn-ink-faint);
  opacity: 0.55;
}

/* ── Toggle + "fly down to Выполнено" animations ── */
.rm-check {
  transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease;
}
.rm-check:hover {
  transform: scale(1.15);
}
.rm-check:active {
  transform: scale(0.9);
}
.rm-check--on {
  animation: rmCheckPop 0.3s ease;
}
@keyframes rmCheckPop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}

.rm-item.rm-leaving {
  animation: rmFlyDown 0.28s ease forwards;
}
.rm-item.rm-entering {
  animation: rmFadeInDown 0.4s ease;
}
@keyframes rmFlyDown {
  from { transform: translateY(0) scale(1); opacity: 1; }
  to { transform: translateY(26px) scale(0.96); opacity: 0; }
}
@keyframes rmFadeInDown {
  from { transform: translateY(-12px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* "Удалить" action shown on completed reminders */
.rm-delete {
  flex: 0 0 auto;
  align-self: center;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  color: var(--wn-rose-ink, #c62828);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 4px;
}
.rm-delete:active {
  opacity: 0.6;
}
WN_TOOLS_EOF

# ---- src/styles/onboarding.css ----
cat > "src/styles/onboarding.css" <<'WN_TOOLS_EOF'
/* Onboarding — welcome (first) screen polish. */

.ob-welcome {
  text-align: center;
}

.ob-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.ob-badge {
  width: 92px;
  height: 92px;
  border-radius: 24px;
  background: linear-gradient(145deg, var(--wn-accent), var(--wn-accent-ink));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 14px 32px rgba(76, 175, 80, 0.35);
  margin-bottom: 6px;
}

.ob-hero-title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 6px 0 0;
  color: var(--wn-ink);
}

.ob-hero-sub {
  font-size: 16px;
  color: var(--wn-ink-mute);
  margin: 0;
}

.ob-lead {
  text-align: center;
  color: var(--wn-ink-soft);
  font-size: 15px;
  line-height: 1.5;
  margin: 18px auto 0;
  max-width: 330px;
}

.ob-pills {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding: 0;
  margin: 22px 0 0;
}
.ob-pills li {
  background: var(--wn-bg-recessed);
  color: var(--wn-ink);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 999px;
}

.ob-hint {
  font-size: 13px;
  color: var(--wn-ink-mute);
  margin: 2px 0 0;
}
WN_TOOLS_EOF

# ---- src/styles/order-builder.css ----
cat > "src/styles/order-builder.css" <<'WN_TOOLS_EOF'
/* OrderBuilder ("Новый заказ") layout fixes.
   - Bound the page to the viewport so the category rail and items pane scroll
     INDEPENDENTLY above the cart sheet (the route is full-screen / hideBottomNav).
   - Reserve space at the bottom equal to the collapsed cart sheet (~180px) so the
     last categories/items can scroll into view instead of hiding behind it.
   - Inset the category rail from the very screen edge.
   The `.ob-page.ob-page` doubling raises specificity so it wins over the base rule
   regardless of stylesheet order. */

.ob-page.ob-page {
  height: 100%;
  min-height: 0;
}

.ob-page .mtp-wrap {
  margin: 0;
  padding-left: 12px;
  min-height: 0;
}

.ob-page .mtp-rail,
.ob-page .mtp-pane {
  padding-bottom: 200px;
}

/* When searching, the results list scrolls within the bounded page too. */
.ob-page .ob-search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
WN_TOOLS_EOF

# ---- src/styles/order-guests.css ----
cat > "src/styles/order-guests.css" <<'WN_TOOLS_EOF'
/* Guest selection (dialog) + guest switcher bar + per-guest cart groups. */

/* ── "How many guests?" dialog ── */
.gcd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}
.gcd {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--wn-bg-elevated);
  border-radius: 20px;
  padding: 22px 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  text-align: center;
}
.gcd-back {
  margin-top: 14px;
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: var(--wn-bg-recessed);
  color: var(--wn-ink);
  border-radius: 12px;
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
}
.gcd-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--wn-ink);
}
.gcd-sub {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--wn-ink-mute);
}
.gcd-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.gcd-num {
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--wn-glass-border-subtle);
  background: var(--wn-bg);
  color: var(--wn-ink);
  border-radius: 14px;
  padding: 14px 0;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.06s ease, background 0.15s ease;
}
.gcd-num:active {
  transform: scale(0.95);
  background: var(--wn-accent-bg);
}
.gcd-hint {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--wn-ink-faint);
}

/* ── Guest switcher bar (above items) ── */
.gb-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 2px 2px 6px;
}
.gb-scroll::-webkit-scrollbar {
  display: none;
}
.gb-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  background: var(--wn-bg-recessed);
  border: 1px solid transparent;
  border-radius: 999px;
  overflow: hidden;
}
.gb-chip--on {
  background: var(--wn-accent-bg);
  border-color: var(--wn-accent);
}
.gb-chip-label {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  color: var(--wn-ink-soft);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.gb-chip--on .gb-chip-label {
  color: var(--wn-accent-ink);
}
.gb-chip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--wn-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.gb-chip-x {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  color: var(--wn-ink-mute);
  font-size: 18px;
  line-height: 1;
  padding: 0 10px 0 2px;
  cursor: pointer;
}
.gb-add {
  flex: 0 0 auto;
  -webkit-appearance: none;
  appearance: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px dashed var(--wn-glass-border);
  background: var(--wn-bg-elevated);
  color: var(--wn-accent-ink);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

/* ── Per-guest groups in the cart — each guest is a distinct card ── */
.cc-guest-group {
  background: var(--wn-bg-elevated);
  border: 1px solid var(--wn-glass-border-subtle);
  border-radius: 16px;
  margin-bottom: 16px;
  overflow: hidden;
  box-shadow: var(--wn-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.06));
}
/* Header strip: accent-tinted so a new guest is unmistakable. */
.cc-guest-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 14px;
  background: var(--wn-accent-bg);
  border-bottom: 1px solid var(--wn-glass-border-subtle);
}
.cc-guest-name {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
  font-weight: 700;
  color: var(--wn-accent-ink);
}
.cc-guest-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--wn-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
.cc-guest-subtotal {
  font-size: 15px;
  font-weight: 700;
  color: var(--wn-accent-ink);
}
/* Items sit inside the card with their own padding. */
.cc-guest-group .cc-items,
.cc-guest-group .ods-items {
  padding: 4px 14px;
}
.cc-guest-empty {
  color: var(--wn-ink-faint);
  font-size: 13px;
  padding: 12px 14px;
}
/* Grand total — a bold standalone bar. */
.cc-grand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding: 14px 16px;
  background: var(--wn-bg-recessed);
  border-radius: 16px;
}
.cc-grand-label {
  font-size: 16px;
  font-weight: 800;
  color: var(--wn-ink);
}
.cc-grand-total {
  font-size: 18px;
  font-weight: 800;
  color: var(--wn-ink);
}

/* Read-only "already in order" items shown as context when adding positions. */
.cc-item--ctx {
  opacity: 0.72;
}
.cc-item--ctx .cc-item-title {
  font-weight: 500;
  color: var(--wn-ink-soft);
}
.cc-item--ctx .cc-item-unit {
  color: var(--wn-accent-ink);
}
WN_TOOLS_EOF

# ---- src/components/BottomNavigation.jsx ----
cat > "src/components/BottomNavigation.jsx" <<'WN_TOOLS_EOF'
import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useUiStore } from '@/stores/ui'

/**
 * Bottom navigation bar with a sliding pill indicator.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - <router-link> → <NavLink> (react-router). We still compute activeIdx
 *   ourselves because the sliding indicator needs the active tab's INDEX,
 *   not just a boolean — NavLink's isActive alone can't drive the pill.
 * - Icons were Vue render functions (h('svg', …)). Here they're plain JSX
 *   SVG components. Same paths, same 24x24 stroke style via currentColor.
 * - useRoute().path → useLocation().pathname.
 * - The "Главная" tab points to /home (our React route), whereas the Vue
 *   app used '/'. Everything else matches the Vue paths.
 * ─────────────────────────────────────────────────────────────────────
 */

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function HomeIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9.5a.5.5 0 0 0 .5.5H9v-6h6v6h3.5a.5.5 0 0 0 .5-.5V10" />
    </svg>
  )
}

function TableIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <rect x="3" y="9" width="3" height="6" rx="0.8" />
      <rect x="18" y="9" width="3" height="6" rx="0.8" />
      <rect x="7.5" y="6" width="9" height="12" rx="1.5" />
    </svg>
  )
}

function ToolsIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  )
}

function ShiftIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <path d="M10 3h4" />
      <path d="M12 3v2.5" />
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13 15 11" />
      <path d="M12 13v-3" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg {...iconProps} className="nav-icon">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.8 4-5.5 7-5.5s5.5 1.7 7 5.5" />
    </svg>
  )
}

const items = [
  { to: '/home', Icon: HomeIcon, label: 'Главная' },
  { to: '/map', Icon: TableIcon, label: 'Карта' },
  {
    to: '/tools',
    Icon: ToolsIcon,
    label: 'Инструменты',
    // Keep this tab highlighted on the tool sub-pages too.
    match: ['/tools', '/notes', '/reminders', '/calculator'],
  },
  { to: '/shifts', Icon: ShiftIcon, label: 'Смены' },
  { to: '/profile', Icon: ProfileIcon, label: 'Профиль' },
]

export default function BottomNavigation() {
  const { pathname } = useLocation()

  // While a full-screen sheet/overlay is open (e.g. the order details sheet),
  // hide the nav: its backdrop-filter would otherwise paint over the sheet's
  // lower buttons ("Перенести"/"Удалить"), and it's non-interactive anyway
  // behind the sheet's backdrop.
  const overlayOpen = useUiStore((s) => s.overlayCount > 0)

  // Some old WebViews don't support backdrop-filter → fall back to an
  // opaque background. CSS.supports is synchronous, so compute it lazily
  // in the useState initializer (runs once) — no effect needed, which
  // keeps the newer react-hooks lint happy.
  const [noBlur] = useState(() => {
    if (typeof CSS === 'undefined' || !CSS.supports) return false
    const supports =
      CSS.supports('backdrop-filter', 'blur(10px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(10px)')
    return !supports
  })

  // Match the deepest tab whose path is a prefix of the current route.
  // Sub-routes (e.g. /order-builder) have hideBottomNav so the bar isn't
  // shown there anyway, but this keeps the indicator sensible otherwise.
  const activeIdx = useMemo(() => {
    // A tab may claim several paths (e.g. Инструменты owns its sub-pages).
    const pathsFor = (it) => it.match ?? [it.to]
    // Exact match first.
    for (let i = 0; i < items.length; i++) {
      if (pathsFor(items[i]).some((p) => p === pathname)) return i
    }
    // Longest prefix match.
    let bestIdx = -1
    let bestLen = 0
    for (let i = 0; i < items.length; i++) {
      for (const p of pathsFor(items[i])) {
        if (pathname.startsWith(p) && p.length > bestLen) {
          bestIdx = i
          bestLen = p.length
        }
      }
    }
    return bestIdx
  }, [pathname])

  // Each tab is (100% / N) wide. The pill is 10% wide (half a tab at N=5);
  // `left` sets its left edge, so center it in the active tab by offsetting
  // a further quarter-tab (matches the Vue math).
  const tabWidthPct = 100 / items.length
  const indicatorLeft =
    activeIdx >= 0
      ? activeIdx * tabWidthPct + tabWidthPct / 2 - tabWidthPct / 4
      : 0

  if (overlayOpen) return null

  return (
    <nav className={noBlur ? 'bottom-nav bottom-nav--no-blur' : 'bottom-nav'}>
      <div className="nav-content">
        <span
          className="indicator"
          style={{ left: `${indicatorLeft}%`, opacity: activeIdx >= 0 ? 1 : 0 }}
          aria-hidden="true"
        />
        {items.map(({ to, Icon, label }, idx) => (
          <NavLink
            key={to}
            to={to}
            className={
              idx === activeIdx ? 'nav-item nav-item--active' : 'nav-item'
            }
          >
            <span className="nav-icon-wrap">
              <Icon />
            </span>
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
WN_TOOLS_EOF

# ---- src/components/PrimaryAction.jsx ----
cat > "src/components/PrimaryAction.jsx" <<'WN_TOOLS_EOF'
import { useLocation, useNavigate, useMatches } from 'react-router-dom'
import { useShiftStore } from '@/stores/shift'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'

/**
 * Floating primary CTA: "Взять заказ" (shift open) or "Открыть смену".
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Visibility was a computed off route.meta.hideBottomNav + route.name.
 *   Here: hideBottomNav comes from useMatches().handle (same source App
 *   uses), and the "hide on these screens" check uses pathname instead of
 *   route.name (React Router has no names).
 * - shift.isOpen was a computed getter → useShiftStore(s => …) selector so
 *   the button re-renders when the shift opens/closes.
 * - router.push({name}) → navigate(path).
 * ─────────────────────────────────────────────────────────────────────
 */

// The floating CTA only makes sense on Главная and Карта — everywhere
// else (Инструменты sub-pages, Профиль, Смены) it would just overlap the
// content, so we show it ONLY on these paths.
const SHOW_ON_PATHS = new Set(['/home', '/map'])

export default function PrimaryAction() {
  const location = useLocation()
  const navigate = useNavigate()
  const matches = useMatches()

  // Subscribe so the label/visibility update when these change.
  const isOpen = useShiftStore((s) => !!s.current && !s.current.is_closed)
  const currentId = useWorkplaceStore((s) => s.currentId)

  const hideBottomNav = matches.some((m) => m.handle?.hideBottomNav === true)

  // Hide while a sheet/overlay or confirm/prompt dialog is open, so the CTA
  // never overlaps (or gets tapped through) the order details sheet buttons.
  const overlayOpen = useUiStore(
    (s) => s.overlayCount > 0 || !!s.confirmDialog || !!s.promptDialog,
  )

  const visible =
    !hideBottomNav &&
    SHOW_ON_PATHS.has(location.pathname) &&
    !!currentId &&
    !overlayOpen

  if (!visible) return null

  const label = isOpen ? '➕ Взять заказ' : '▶ Открыть смену'

  const onClick = () => {
    if (isOpen) {
      // Jump straight into the order builder; user picks a table inside.
      navigate('/order-builder')
    } else {
      // Shift closed — go to Shifts so they can review defaults first.
      navigate('/shifts')
    }
  }

  return (
    <button
      className={
        isOpen ? 'primary-action' : 'primary-action primary-action--accent'
      }
      onClick={onClick}
    >
      <span className="primary-action-label">{label}</span>
    </button>
  )
}
WN_TOOLS_EOF

# ---- src/router/index.jsx ----
cat > "src/router/index.jsx" <<'WN_TOOLS_EOF'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '@/App'

// ── Vue Router → React Router mapping ───────────────────────────────
// Vue Router                          React Router 7
//   createWebHashHistory()              createHashRouter([...])
//   { path, name, component }           { path, element }   (no `name`)
//   component: () => import(...)         lazy: () => import(...)
//   <router-view/>                       <Outlet/> (rendered inside App)
//   meta: { hideBottomNav: true }        handle: { hideBottomNav: true }
//   children: [...]                      children: [...]
//   scrollBehavior(){...}                <ScrollReset/> component (step 3)
//
// Note on `meta` → `handle`: React Router exposes per-route static data
// via `route.handle`, read with the useMatches() hook. We use it to carry
// the same `hideBottomNav` flag your Vue routes had in `meta`.
//
// Note on `name`: React Router has no route names. Navigation is by path.
// Anywhere the Vue code used route.name (e.g. navigation memory), the
// React code will use location.pathname instead. We'll handle that when
// porting App.jsx.
//
// Note on hash history: kept from the Vue project. For a Telegram Mini App
// it avoids server-rewrite config and survives reloads on deep paths.
// ────────────────────────────────────────────────────────────────────

// Browser history (clean URLs). Firebase Hosting rewrites all paths to
// index.html (see firebase.json), so deep links and reloads work. We avoid
// hash history because Telegram Mini Apps append #tgWebAppData=... to the
// URL, which a hash router would mis-parse as a route → 404.
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      {
        path: 'home',
        lazy: async () => ({
          Component: (await import('@/views/main/Main')).default,
        }),
      },
      {
        path: 'map',
        lazy: async () => ({
          Component: (await import('@/views/hall/map')).default,
        }),
      },
      {
        path: 'shifts',
        lazy: async () => ({
          Component: (await import('@/views/shifts/Shifts')).default,
        }),
      },
      {
        path: 'notes',
        lazy: async () => ({
          Component: (await import('@/views/notes/Notes')).default,
        }),
      },
      // ── Инструменты: landing + sub-tools. ──
      {
        path: 'tools',
        lazy: async () => ({
          Component: (await import('@/views/tools/ToolsView')).default,
        }),
      },
      {
        path: 'reminders',
        lazy: async () => ({
          Component: (await import('@/views/tools/RemindersView')).default,
        }),
      },
      {
        path: 'calculator',
        lazy: async () => ({
          Component: (await import('@/views/tools/CalculatorView')).default,
        }),
      },
      {
        path: 'menu',
        lazy: async () => ({
          Component: (await import('@/views/menu/MenuEditorView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'hall-editor',
        lazy: async () => ({
          Component: (await import('@/views/hall/HallEditorView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'order-history',
        lazy: async () => ({
          Component: (await import('@/views/order/OrderHistoryView')).default,
        }),
        handle: { hideBottomNav: true },
      },

      {
        path: 'profile',
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/views/profile/ProfileView')).default,
            }),
          },
          {
            path: 'appearance',
            lazy: async () => ({
              Component: (await import('@/views/profile/AppearanceView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'share',
            lazy: async () => ({
              Component: (await import('@/views/profile/ShareView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'workplaces',
            lazy: async () => ({
              Component: (await import('@/views/profile/WorkplacesView')).default,
            }),
            handle: { hideBottomNav: true },
          },
          {
            path: 'dev',
            lazy: async () => ({
              Component: (await import('@/views/profile/DevToolsView')).default,
            }),
            handle: { hideBottomNav: true },
          },
        ],
      },

      {
        path: 'onboarding',
        lazy: async () => ({
          Component: (await import('@/views/onboarding/OnboardingView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'bot-required',
        lazy: async () => ({
          Component: (await import('@/views/auth/BotRequiredView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'import',
        lazy: async () => ({
          Component: (await import('@/views/import/ImportFromCodeView')).default,
        }),
        handle: { hideBottomNav: true },
      },
      {
        path: 'order-builder',
        lazy: async () => ({
          Component: (await import('@/views/order/OrderBuilderView')).default,
        }),
        handle: { hideBottomNav: true },
      },
    ],
  },
])

export default router
WN_TOOLS_EOF

# ---- src/views/notes/Notes.jsx ----
cat > "src/views/notes/Notes.jsx" <<'WN_TOOLS_EOF'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notes'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import NoteCard from './NoteCard'
import NoteFormModal from './NoteFormModal'

/**
 * Notes screen. (Was Notes.vue.)
 * - All the computed filters (availableTabs, visibleNotes) → useMemo over
 *   raw `items` + the local filter state (search/tab/archived).
 * - search/tab/archived/formVisible/editingNote → useState.
 */

const sortNotes = (arr) =>
  [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updated_at - a.updated_at
  })

export default function Notes() {
  const navigate = useNavigate()
  const items = useNotesStore((s) => s.items)
  const isLoading = useNotesStore((s) => s.isLoading)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentShift = useShiftStore((s) => s.current)

  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [formVisible, setFormVisible] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  // Derived base lists (mirror the notes-store getters, but local so they
  // stay reactive to `items`).
  const sorted = useMemo(() => sortNotes(items), [items])
  const active = useMemo(() => sorted.filter((n) => !n.is_archived), [sorted])
  const archived = useMemo(() => sorted.filter((n) => n.is_archived), [sorted])
  const totalCount = active.length

  const availableTabs = useMemo(() => {
    const tabs = [{ key: 'all', label: 'Все', count: active.length }]
    if (currentId) {
      tabs.push({
        key: 'workplace',
        label: 'Заведение',
        count: active.filter((n) => n.workplace_id === currentId).length,
      })
    }
    if (currentShift) {
      tabs.push({
        key: 'shift',
        label: 'Смена',
        count: active.filter((n) => n.shift_id === currentShift.id).length,
      })
    }
    tabs.push({
      key: 'global',
      label: 'Личное',
      count: active.filter((n) => n.scope === 'global').length,
    })
    return tabs
  }, [active, currentId, currentShift])

  const visibleNotes = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return []
      return (showArchived ? sorted : active).filter(
        (n) =>
          n.header.toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q),
      )
    }
    if (showArchived) return archived
    switch (activeTab) {
      case 'workplace':
        return currentId ? active.filter((n) => n.workplace_id === currentId) : []
      case 'shift':
        return currentShift
          ? active.filter((n) => n.shift_id === currentShift.id)
          : []
      case 'global':
        return active.filter((n) => n.scope === 'global')
      default:
        return active
    }
  }, [searchQuery, showArchived, activeTab, sorted, active, archived, currentId, currentShift])

  const defaultScopeForCreate = useMemo(() => {
    if (activeTab === 'shift' && currentShift) return 'shift'
    if (activeTab === 'workplace' && currentId) return 'workplace'
    return 'global'
  }, [activeTab, currentShift, currentId])

  const openCreate = () => {
    setEditingNote(null)
    setFormVisible(true)
  }
  const openEdit = (note) => {
    setEditingNote(note)
    setFormVisible(true)
  }
  const closeForm = () => {
    setFormVisible(false)
    setEditingNote(null)
  }

  return (
    <div className="page notes-page">
      <header className="notes-header">
        <div className="notes-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="back-btn"
              onClick={() => navigate('/tools')}
              aria-label="Назад"
              style={{ paddingLeft: 0 }}
            >
              <svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <h1 className="notes-title">Заметки</h1>
          </div>
          {archived.length > 0 && (
            <label className="archive-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Архив ({archived.length})</span>
            </label>
          )}
        </div>
        <WorkplaceSwitcher />
      </header>

      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по заметкам…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>

      {!searchQuery && (
        <div className="tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'tab tab--active' : 'tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="notes-empty">
          <p className="empty-text">
            {searchQuery
              ? 'Ничего не найдено'
              : showArchived && archived.length === 0
                ? 'В архиве пусто'
                : totalCount === 0
                  ? 'Пока нет заметок'
                  : 'В этой вкладке пусто'}
          </p>
          {totalCount === 0 && !searchQuery && (
            <button className="btn-primary" onClick={openCreate}>
              Создать первую
            </button>
          )}
        </div>
      ) : (
        <div className="list">
          {visibleNotes.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={openEdit} />
          ))}
        </div>
      )}

      {!showArchived && (
        <button className="fab" onClick={openCreate} aria-label="Новая заметка">
          +
        </button>
      )}

      {formVisible && (
        <NoteFormModal
          initial={editingNote}
          defaultScope={defaultScopeForCreate}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/onboarding/OnboardingView.jsx ----
cat > "src/views/onboarding/OnboardingView.jsx" <<'WN_TOOLS_EOF'
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
WN_TOOLS_EOF

# ---- src/views/order/OrderBuilderView.jsx ----
cat > "src/views/order/OrderBuilderView.jsx" <<'WN_TOOLS_EOF'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMenuStore } from '@/stores/menu'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'
import { formatMoney } from '@/utils/format'
import { hapticImpact } from '@/utils/telegram'
import BottomSheet from '@/components/BottomSheet'
import MenuTwoPanel from '@/views/menu/MenuTwoPanel'
import MenuPickRow from './MenuPickRow'
import CartContent from './CartContent'
import TablePickerSheet from './TablePickerSheet'
import { GuestCountDialog, GuestBar } from './OrderGuests'
import '@/styles/order-builder.css'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/**
 * Order builder. (Was OrderBuilderView.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Three URL modes via useSearchParams, read once into useState: ?table_id
 *   (new), ?edit_paid (edit a paid order), ?add_to_order (append items).
 * - draft getters are methods → subscribe to raw `draft` + menu raw state,
 *   derive itemCount/total/isEmpty and category/search lists via useMemo;
 *   call draftQuantityOfMenuItem(id) per row.
 * - onMounted setup (shift guard + draft seeding) → a mount effect; it reads
 *   the URL and seeds the store (external system), the allowed effect kind.
 * - cart BottomSheet via ref so the header tap can snapTo(1).
 * - $emit handlers → store actions; post-submit router.replace → navigate.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function OrderBuilderView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const draft = useOrderStore((s) => s.draft)
  const orders = useOrderStore((s) => s.orders)
  const menuItems = useMenuStore((s) => s.items)
  const menuCategories = useMenuStore((s) => s.categories)
  const selectedCategoryId = useMenuStore((s) => s.selectedCategoryId)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')
  const currentId = useWorkplaceStore((s) => s.currentId)

  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tablePickerVisible, setTablePickerVisible] = useState(false)
  const [contextTableNum, setContextTableNum] = useState(null)
  const [selectedGuest, setSelectedGuest] = useState(1)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const cartSheetRef = useRef(null)

  const snapPoints = useMemo(() => [180, 0.55, 0.92], [])

  // Read the URL modes once.
  const [editingPaidId] = useState(() => searchParams.get('edit_paid') || null)
  const [addingToOrderId] = useState(() => searchParams.get('add_to_order') || null)

  // === Derived menu lists (getters are methods → derive here) ===
  const allCategories = menuCategories
  const activeCategories = useMemo(
    () => menuCategories.filter((c) => c.is_active),
    [menuCategories],
  )
  const activeItems = useMemo(() => {
    if (!selectedCategoryId) return []
    return menuItems.filter((i) => i.category_id === selectedCategoryId && i.is_active)
  }, [menuItems, selectedCategoryId])

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return []
    return menuItems
      .filter((i) => i.is_active && i.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [menuItems, searchQuery])

  // === Derived draft values ===
  const draftItems = useMemo(() => draft?.items || [], [draft?.items])
  const draftIsEmpty = draftItems.length === 0
  const draftItemCount = useMemo(
    () => draftItems.reduce((sum, i) => sum + i.quantity, 0),
    [draftItems],
  )
  const draftTotal = useMemo(
    () => draftItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [draftItems],
  )
  const guestCount = draft?.guestCount || 1
  // Clamp selection into range (e.g. after a guest is removed) without an effect.
  const activeGuest = Math.min(selectedGuest, guestCount) || 1

  // When adding to an existing order — its current items, shown as read-only
  // context in the cart so it's clear who already has what.
  const contextItems = useMemo(() => {
    if (!addingToOrderId) return []
    return orders.find((o) => o.id === addingToOrderId)?.items || []
  }, [addingToOrderId, orders])

  // Quantity of a menu item for the CURRENTLY selected guest (drives the
  // badge/qty on menu cards, so building each guest's order is independent).
  const qtyOf = (menuItemId) =>
    draftItems
      .filter((i) => i.menu_item_id === menuItemId && (i.guest || 1) === activeGuest)
      .reduce((sum, i) => sum + i.quantity, 0)

  // Item quantity per guest, for the small badge on each guest tab.
  const guestCounts = useMemo(() => {
    const m = {}
    for (const i of draftItems) {
      const g = i.guest || 1
      m[g] = (m[g] || 0) + i.quantity
    }
    return m
  }, [draftItems])

  const hallTables = useHallStore((s) => s.tables)
  const hallList = useHallStore((s) => s.halls)
  const draftTableId = draft?.tableId || null
  const selectedTable = useMemo(
    () => (draftTableId ? hallTables.find((t) => t.id === draftTableId) ?? null : null),
    [draftTableId, hallTables],
  )
  const selectedHall = useMemo(
    () =>
      selectedTable
        ? hallList.find((h) => h.id === selectedTable.hall_id) ?? null
        : null,
    [selectedTable, hallList],
  )

  const canSubmit = !draftIsEmpty

  // === Mount setup: shift guard + draft seeding (reads URL, seeds store) ===
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    const hall = useHallStore.getState()

    if (!useShiftStore.getState().isOpen()) {
      ui.toastError('Откройте смену, чтобы принимать заказы')
      navigate('/shifts', { replace: true })
      return
    }

    if (editingPaidId) {
      const o = order.orderById(editingPaidId)
      if (!o || !o.is_paid) {
        ui.toastError('Закрытый заказ не найден')
        navigate('/order-history', { replace: true })
        return
      }
      setContextTableNum(o.table_number || null)
      order.replaceDraftWithPaidOrder(o)
      return
    }

    if (addingToOrderId) {
      const o = order.orderById(addingToOrderId)
      if (!o || o.is_paid) {
        ui.toastError('Активный заказ не найден')
        navigate('/map', { replace: true })
        return
      }
      setContextTableNum(o.table_number || null)
      order.replaceDraftEphemeral({
        tableId: o.table_id || null,
        hallId: o.hall_id || null,
        guestsCount: o.guests_count || 1,
      })
      return
    }

    // Starting/continuing a NEW order. The guest dialog must appear whenever
    // you begin a fresh order (tap any free table or "Взять заказ"). We only
    // resume an existing draft when it's the SAME table (or a non-empty
    // table-less cart) — otherwise a leftover guest count from another table
    // would carry over.
    const queryTableId = searchParams.get('table_id')
    const d = order.draft
    const draftHasItems = !!d && d.items.length > 0
    if (queryTableId) {
      const t = hall.tableById(queryTableId)
      const tid = t?.id || null
      if (!d || d.tableId !== tid) {
        order.startDraft({ tableId: tid, hallId: t?.hall_id || null })
        setGuestDialogOpen(true)
      }
      // same table → resume current draft (keep items + guests)
    } else if (!d || !draftHasItems) {
      // Table-less "Взять заказ": start fresh + ask, unless resuming a
      // non-empty table-less cart.
      order.startDraft()
      setGuestDialogOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Default-select a category once the menu loads.
  useEffect(() => {
    if (allCategories.length > 0 && !selectedCategoryId) {
      const first = activeCategories[0]?.id || allCategories[0]?.id
      if (first) useMenuStore.getState().selectCategory(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // === Actions ===
  const onAddToCart = (item) => {
    useOrderStore.getState().addToDraft(item, { guest: activeGuest })
    hapticImpact('light')
  }

  const onAddGuest = () => {
    useOrderStore.getState().addGuest()
    setSelectedGuest((useOrderStore.getState().draft?.guestCount) || 1)
  }

  const onRemoveGuest = async (g) => {
    const order = useOrderStore.getState()
    const hasItems = (order.draft?.items || []).some((i) => (i.guest || 1) === g)
    const ok = await useUiStore.getState().confirm({
      title: `Удалить гостя ${g}?`,
      message: hasItems
        ? 'Позиции этого гостя будут удалены из заказа.'
        : 'Гость будет удалён, остальные перенумеруются.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (!ok) return
    order.removeGuest(g)
    setSelectedGuest((s) => Math.min(s, order.draft?.guestCount || 1) || 1)
  }

  const onSubmit = async () => {
    if (!canSubmit || submitting) return
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    setSubmitting(true)
    try {
      if (addingToOrderId) {
        const items = (order.draft?.items || []).map((i) => ({
          menu_item_id: i.menu_item_id,
          title: i.title,
          price: i.price,
          quantity: i.quantity,
          comment: i.comment || null,
          guest: i.guest || 1,
        }))
        const updated = await order.addItemsToOrder(addingToOrderId, items)
        order.clearDraft()
        ui.toastSuccess(
          `Добавлено к заказу${updated.table_number ? ` · стол №${updated.table_number}` : ''}`,
        )
        if (updated.table_id) {
          navigate(`/map?show_order=${encodeURIComponent(updated.id)}`, { replace: true })
        } else {
          navigate('/map', { replace: true })
        }
        return
      }

      if (editingPaidId) {
        const patch = {
          items: (order.draft?.items || []).map((i) => ({
            id: i.id,
            menu_item_id: i.menu_item_id,
            title: i.title,
            price: i.price,
            quantity: i.quantity,
            comment: i.comment || null,
            guest: i.guest || 1,
          })),
          guests_count: order.draft?.guestCount || 1,
          comments: order.draft?.comments || null,
        }
        await order.editPaidOrder(editingPaidId, patch)
        order.clearDraft()
        ui.toastSuccess('Изменения сохранены')
        navigate('/order-history', { replace: true })
        return
      }

      const created = await order.submitDraft({ workplaceId: currentId })
      ui.toastSuccess(
        `Заказ принят${created.table_number ? ` · стол №${created.table_number}` : ''}`,
      )
      if (created.table_id) {
        navigate(`/map?highlight_table=${encodeURIComponent(created.table_id)}`, {
          replace: true,
        })
      } else {
        navigate('/map', { replace: true })
      }
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const editOrderComment = async () => {
    const order = useOrderStore.getState()
    const value = await useUiStore.getState().prompt({
      title: 'Комментарий к заказу',
      initial: order.draft?.comments || '',
      placeholder: 'Например: гость справа, оплата картой',
      multiline: true,
      rows: 3,
      maxLength: 2000,
      confirmText: 'Сохранить',
    })
    if (value === null) return
    order.setDraftComments(value.trim() || '')
  }

  const onClearDraft = async () => {
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Очистить корзину?',
      message: 'Все добавленные позиции будут удалены.',
      confirmText: 'Очистить',
      danger: true,
    })
    if (!ok) return
    // Only the dish positions are removed — table, hall and the chosen
    // number of guests stay (in add-to-order mode keep the order's guests).
    if (addingToOrderId) {
      const o = order.orderById(addingToOrderId)
      order.replaceDraftEphemeral({
        tableId: o?.table_id || null,
        hallId: o?.hall_id || null,
        guestsCount: o?.guests_count || order.draft?.guestCount || 1,
      })
    } else {
      order.clearDraftItems()
    }
  }

  const onTableSelect = (tableId) => {
    const order = useOrderStore.getState()
    if (tableId == null) {
      order.setDraftTable(null, null)
    } else {
      const t = useHallStore.getState().tableById(tableId)
      if (t) order.setDraftTable(t.id, t.hall_id)
    }
    setTablePickerVisible(false)
  }

  const expandCart = () => cartSheetRef.current?.snapTo(1)
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/map')
  }
  const goToMenuEditor = () => navigate('/menu')

  const title = editingPaidId
    ? `Изменение заказа${contextTableNum ? ` · стол №${contextTableNum}` : ''}`
    : addingToOrderId
      ? `+ к заказу${contextTableNum ? ` · стол №${contextTableNum}` : ''}`
      : 'Новый заказ'

  const submitLabel = submitting
    ? editingPaidId
      ? 'Сохраняем…'
      : addingToOrderId
        ? 'Добавляем…'
        : 'Создаём…'
    : editingPaidId
      ? `Сохранить изменения · ${formatMoney(draftTotal, currency)}`
      : addingToOrderId
        ? `Добавить к заказу · ${formatMoney(draftTotal, currency)}`
        : `Собрать заказ · ${formatMoney(draftTotal, currency)}`

  // === Cart sheet header + footer ===
  const cartHeader = (
    <>
      <div className="ob-cart-header" onClick={expandCart}>
        <div className="ob-cart-summary">
          <span className="ob-cart-count">
            {draftItemCount} {pluralize(draftItemCount, ['позиция', 'позиции', 'позиций'])}
          </span>
          <span className="ob-cart-total">{formatMoney(draftTotal, currency)}</span>
        </div>
      </div>

      {!editingPaidId && !addingToOrderId ? (
        <button className="ob-table-plate" onClick={() => setTablePickerVisible(true)}>
          <span className="ob-table-plate-icon">🪑</span>
          {selectedTable ? (
            <span className="ob-table-plate-text">
              Стол №{selectedTable.number}
              {selectedHall && <small> · {selectedHall.name}</small>}
            </span>
          ) : (
            <span className="ob-table-plate-text ob-table-plate-text--empty">
              Стол не выбран
            </span>
          )}
          <span className="ob-table-plate-edit">✏️</span>
        </button>
      ) : (
        contextTableNum && (
          <div className="ob-table-plate ob-table-plate--readonly">
            <span className="ob-table-plate-icon">🪑</span>
            <span className="ob-table-plate-text">Стол №{contextTableNum}</span>
          </div>
        )
      )}
    </>
  )

  const cartFooter = (
    <button className="ob-submit-btn" disabled={!canSubmit || submitting} onClick={onSubmit}>
      {submitLabel}
    </button>
  )

  return (
    <div className="ob-page">
      <header className="ob-header">
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
        <h1 className="ob-title">{title}</h1>
        {!draftIsEmpty && !editingPaidId && (
          <button className="ob-clear-btn" onClick={onClearDraft} aria-label="Очистить корзину">
            Очистить
          </button>
        )}
      </header>

      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по меню…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      {searchQuery ? (
        <section className="ob-search-results">
          {searchResults.length === 0 ? (
            <div className="ob-empty">
              <p>Ничего не найдено</p>
            </div>
          ) : (
            <>
              <p className="ob-search-count">Найдено: {searchResults.length}</p>
              <div className="ob-items">
                {searchResults.map((item) => (
                  <MenuPickRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    quantity={qtyOf(item.id)}
                    onAdd={onAddToCart}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
    <>
      {activeCategories.length === 0 ? (
        <div className="ob-empty ob-empty--centered">
          <p>В меню нет активных категорий.</p>
          <button className="btn-link" onClick={goToMenuEditor}>
            Открыть редактор
          </button>
        </div>
      ) : (
        <MenuTwoPanel
          categories={activeCategories}
          selectedId={selectedCategoryId}
          items={activeItems}
          onSelect={(id) => useMenuStore.getState().selectCategory(id)}
          emptyText="В этой категории пока нет позиций"
          headerSlot={
            <GuestBar
              guestCount={guestCount}
              selected={activeGuest}
              counts={guestCounts}
              onSelect={setSelectedGuest}
              onAdd={onAddGuest}
              onRemove={onRemoveGuest}
            />
          }
          renderItem={(item) => (
            <MenuPickRow
              key={item.id}
              item={item}
              currency={currency}
              quantity={qtyOf(item.id)}
              onAdd={onAddToCart}
            />
          )}
        />
      )}
    </>
  )}

      <BottomSheet
        ref={cartSheetRef}
        visible={true}
        snapPoints={snapPoints}
        initialSnap={0}
        header={cartHeader}
        footer={cartFooter}
      >
        <CartContent
          items={draftItems}
          contextItems={contextItems}
          currency={currency}
          guestCount={guestCount}
          onInc={(id) => useOrderStore.getState().incDraftItem(id)}
          onDec={(id) => useOrderStore.getState().decDraftItem(id)}
          onUpdateComment={(id, comment) =>
            useOrderStore.getState().updateDraftItem(id, { comment })
          }
        />

        {!draftIsEmpty && (
          <div className="ob-order-comment">
            <span className="ob-order-comment-label">Комментарий к заказу</span>
            <button
              className={
                draft?.comments
                  ? 'ob-order-comment-btn'
                  : 'ob-order-comment-btn ob-order-comment-btn--empty'
              }
              onClick={editOrderComment}
            >
              {draft?.comments ? (
                <span className="ob-order-comment-text">💬 {draft.comments}</span>
              ) : (
                <span className="ob-order-comment-placeholder">+ Добавить комментарий</span>
              )}
            </button>
          </div>
        )}
      </BottomSheet>

      <TablePickerSheet
        visible={tablePickerVisible}
        currentTableId={draft?.tableId}
        freeOnly={true}
        onClose={() => setTablePickerVisible(false)}
        onSelect={onTableSelect}
      />

      {guestDialogOpen && (
        <GuestCountDialog
          onPick={(n) => {
            useOrderStore.getState().setGuestCount(n)
            setSelectedGuest(1)
            setGuestDialogOpen(false)
          }}
          onCancel={() => {
            setGuestDialogOpen(false)
            useOrderStore.getState().clearDraft()
            goBack()
          }}
        />
      )}
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/order/OrderGuests.jsx ----
cat > "src/views/order/OrderGuests.jsx" <<'WN_TOOLS_EOF'
import '@/styles/order-guests.css'

/**
 * "How many guests?" dialog shown when starting a new order.
 * 1 = single bill ("Один чек"); 2..10 = split the order per guest.
 */
export function GuestCountDialog({ onPick, onCancel }) {
  return (
    <div className="gcd-overlay">
      <div className="gcd">
        <h2 className="gcd-title">Сколько гостей?</h2>
        <p className="gcd-sub">«1» — один общий чек на стол</p>
        <div className="gcd-grid">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} className="gcd-num" onClick={() => onPick(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="gcd-hint">Число гостей можно изменить позже (кнопка «＋»).</p>
        <button className="gcd-back" onClick={onCancel}>
          Назад
        </button>
      </div>
    </div>
  )
}

/**
 * Horizontal guest switcher shown above the items.
 * - 1 guest → a single "Один чек" tab.
 * - 2+ → "Гость 1 … N", each removable (×), plus "＋" to add (up to 10).
 * `counts` is an optional map { [guest]: itemQty } for a small badge.
 */
export function GuestBar({ guestCount, selected, counts = {}, onSelect, onAdd, onRemove }) {
  const single = guestCount <= 1
  return (
    <div className="gb-scroll" role="tablist" aria-label="Гости">
      {Array.from({ length: guestCount }, (_, i) => i + 1).map((g) => {
        const on = g === selected
        const qty = counts[g] || 0
        return (
          <div key={g} className={on ? 'gb-chip gb-chip--on' : 'gb-chip'}>
            <button
              type="button"
              className="gb-chip-label"
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(g)}
            >
              {single ? 'Один чек' : `Гость ${g}`}
              {qty > 0 && <span className="gb-chip-badge">{qty}</span>}
            </button>
            {!single && (
              <button
                type="button"
                className="gb-chip-x"
                aria-label={`Удалить гостя ${g}`}
                onClick={() => onRemove(g)}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      {guestCount < 10 && (
        <button type="button" className="gb-add" onClick={onAdd} aria-label="Добавить гостя">
          ＋
        </button>
      )}
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/order/CartContent.jsx ----
cat > "src/views/order/CartContent.jsx" <<'WN_TOOLS_EOF'
import { formatMoney } from '@/utils/format'
import { useUiStore } from '@/stores/ui'

/**
 * Cart contents. (Was CartContent.vue.)
 * Item comments are edited via the central prompt modal.
 *
 * When `guestCount` > 1 the items are grouped per guest with a subtotal
 * for each guest and a grand total at the end. With a single guest it's a
 * plain flat list (the sheet header already shows the total).
 */
export default function CartContent({
  items,
  contextItems = [],
  currency = 'RUB',
  guestCount = 1,
  onInc,
  onDec,
  onUpdateComment,
}) {
  const editComment = async (item) => {
    const value = await useUiStore.getState().prompt({
      title: `Комментарий: ${item.title}`,
      initial: item.comment || '',
      placeholder: 'Например: без сахара',
      multiline: true,
      rows: 3,
      maxLength: 2000,
      confirmText: 'Сохранить',
    })
    if (value === null) return
    onUpdateComment?.(item.id, value.trim() || null)
  }

  const renderItem = (item) => (
    <li key={item.id} className="cc-item">
      <div className="cc-item-main">
        <div className="cc-item-title-row">
          <span className="cc-item-title">{item.title}</span>
          <span className="cc-item-price">
            {formatMoney(item.price * item.quantity, currency)}
          </span>
        </div>
        <div className="cc-item-meta">
          <span className="cc-item-unit">
            {formatMoney(item.price, currency)} × {item.quantity}
          </span>
        </div>
        <div className="cc-item-comment-row">
          {!item.comment ? (
            <button className="cc-add-comment" onClick={() => editComment(item)}>
              + Комментарий
            </button>
          ) : (
            <button className="cc-comment-display" onClick={() => editComment(item)}>
              💬 {item.comment}
            </button>
          )}
        </div>
      </div>

      <div className="cc-item-actions">
        <button className="cc-qty-btn" onClick={() => onDec?.(item.id)} aria-label="Меньше">
          −
        </button>
        <span className="cc-qty">{item.quantity}</span>
        <button className="cc-qty-btn" onClick={() => onInc?.(item.id)} aria-label="Больше">
          +
        </button>
      </div>
    </li>
  )

  // Read-only line for items already in the order (shown as context when
  // adding positions, so it's clear who already has what).
  const renderContextItem = (item) => (
    <li key={`ctx-${item.id}`} className="cc-item cc-item--ctx">
      <div className="cc-item-main">
        <div className="cc-item-title-row">
          <span className="cc-item-title">{item.title}</span>
          <span className="cc-item-price">
            {formatMoney(item.total_price ?? item.price * item.quantity, currency)}
          </span>
        </div>
        <div className="cc-item-meta">
          <span className="cc-item-unit">уже в заказе · × {item.quantity}</span>
        </div>
      </div>
    </li>
  )

  const hasCtx = contextItems.length > 0

  // Money of a line works for both new draft items (price × qty) and the
  // read-only context items already in the order (they carry total_price).
  const lineSum = (it) => it.total_price ?? it.price * it.quantity
  const sumOf = (arr) => arr.reduce((s, it) => s + lineSum(it), 0)
  // Grand total = the WHOLE order: existing items + the ones being added.
  const grand = sumOf(contextItems) + sumOf(items)

  if (items.length === 0 && !hasCtx) {
    return (
      <div className="cc-cart">
        <div className="cc-empty">
          <p>Корзина пуста</p>
          <p className="cc-empty-sub">Добавляйте позиции из меню</p>
        </div>
      </div>
    )
  }

  // Single guest → plain flat list (context first, then new items). When
  // adding to an existing order, show the combined order total at the end.
  if (guestCount <= 1) {
    return (
      <div className="cc-cart">
        <ul className="cc-items">
          {contextItems.map(renderContextItem)}
          {items.map(renderItem)}
        </ul>
        {hasCtx && (
          <div className="cc-grand">
            <span className="cc-grand-label">Итого по заказу</span>
            <span className="cc-grand-total">{formatMoney(grand, currency)}</span>
          </div>
        )}
      </div>
    )
  }

  // Multiple guests → group by guest; each shows existing (context) items
  // then the new ones. Per-guest subtotal and grand total cover the WHOLE
  // order (existing + added), so "+ Позиции" shows the full bill.
  return (
    <div className="cc-cart">
      {Array.from({ length: guestCount }, (_, i) => i + 1).map((g) => {
        const ctx = contextItems.filter((it) => (it.guest || 1) === g)
        const guestItems = items.filter((it) => (it.guest || 1) === g)
        if (ctx.length === 0 && guestItems.length === 0) return null
        const subtotal = sumOf(ctx) + sumOf(guestItems)
        return (
          <div className="cc-guest-group" key={g}>
            <div className="cc-guest-head">
              <span className="cc-guest-name">
                <span className="cc-guest-badge">{g}</span>
                Гость {g}
              </span>
              <span className="cc-guest-subtotal">{formatMoney(subtotal, currency)}</span>
            </div>
            <ul className="cc-items">
              {ctx.map(renderContextItem)}
              {guestItems.map(renderItem)}
            </ul>
          </div>
        )
      })}
      <div className="cc-grand">
        <span className="cc-grand-label">Итого по заказу</span>
        <span className="cc-grand-total">{formatMoney(grand, currency)}</span>
      </div>
    </div>
  )
}
WN_TOOLS_EOF

# ---- src/views/order/OrderDetailsSheet.jsx ----
cat > "src/views/order/OrderDetailsSheet.jsx" <<'WN_TOOLS_EOF'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '@/stores/order'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney, formatDuration } from '@/utils/format'
import { hapticImpact } from '@/utils/telegram'
import { useLiveDuration } from '@/hooks/useLiveDuration'
import TablePickerSheet from './TablePickerSheet'
import '@/styles/order-guests.css'

/**
 * Order details sheet — two modes: active (pay/add/move/delete) and paid
 * (reopen/edit). (Was OrderDetailsSheet.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - liveOrder: re-reads the order from the store by id each render so
 *   optimistic updates (served toggle) reflect instantly. Was a computed;
 *   here useMemo over the store's orders + the prop fallback.
 * - watch(order.id) resetting tips → useEffect keyed on order?.id.
 * - useLiveDuration composable → hook.
 * - $emit('close'|'reopen'|'edit') → onClose / onReopen / onEdit.
 *
 * ── Move ────────────────────────────────────────────────────────────
 * "Перенести на другой стол" opens TablePickerSheet inline (state
 * movePickerVisible); picking a table calls moveOrder, picking "Без стола"
 * detaches. Paid mode (history) never shows move.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function OrderDetailsSheet({
  visible = false,
  order = null,
  paidMode = false,
  onClose,
  onReopen,
  onEdit,
}) {
  const navigate = useNavigate()
  const orders = useOrderStore((s) => s.orders)
  const workplaceCurrency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const [busy, setBusy] = useState(false)
  const [movePickerVisible, setMovePickerVisible] = useState(false)
  // Prefill from the order's saved tips in paid mode so history can quickly
  // correct a forgotten tip. The sheet remounts per order (key={order.id}),
  // so this initializer runs fresh for each opened order.
  const [tipsAmount, setTipsAmount] = useState(() =>
    paidMode && order?.tips ? String(order.tips) : '',
  )
  // NOTE: tips reset on order change is handled by remounting via a
  // key={order.id} at the call site (OrderHistoryView / Map), so no
  // setState-in-effect is needed here.

  // While the sheet is open, register a global overlay so the floating
  // "Взять заказ" CTA hides — otherwise it overlaps "Оплатить"/"+ Позиции".
  useEffect(() => {
    if (!visible) return undefined
    const ui = useUiStore.getState()
    ui.pushOverlay()
    return () => ui.popOverlay()
  }, [visible])

  // Fresh order from the store (fallback to prop for paid/history orders
  // that may not be in the active orders list).
  const liveOrder = useMemo(() => {
    const id = order?.id
    if (!id) return order
    return orders.find((o) => o.id === id) || order
  }, [orders, order])

  const currency = liveOrder?.currency || workplaceCurrency
  const orderItems = liveOrder?.items || []
  const canPay = orderItems.length > 0
  const guestsCount = liveOrder?.guests_count || 1

  const tipsValue = useMemo(() => {
    const n = Number(tipsAmount)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [tipsAmount])

  // Tips are recorded separately (waiter's earnings / shift tips) — they are
  // NOT part of the order's cost, so "Сумма"/"К оплате"/"Итого" всегда равны
  // стоимости позиций заказа. Чаевые показываем отдельной строкой. The input
  // drives the displayed tips in both modes (in paid mode it's prefilled).
  const orderTotal = liveOrder?.total_price || 0
  const paidTips = tipsValue
  // In history, allow saving an edited tip (e.g. a forgotten one).
  const savedTips = Number(liveOrder?.tips) || 0
  const tipsDirty = paidMode && tipsValue !== savedTips

  const seconds = useLiveDuration(() => liveOrder?.created_at)
  const openedAgo = formatDuration(seconds)
  const closedAtLabel = liveOrder?.closed_at
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(liveOrder.closed_at * 1000),
      )
    : ''

  if (!visible) return null

  const onToggleServed = async (item) => {
    if (!order) return
    hapticImpact('light')
    try {
      await useOrderStore.getState().toggleItemServed(order.id, item.id)
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    }
  }

  const onRemoveItem = async (item) => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Убрать позицию?',
      message: `«${item.title}» будет удалена из заказа.`,
      confirmText: 'Убрать',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().removeOrderItem(item.id)
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Quick-save tips on a closed order (history) without the full edit flow.
  const onSaveTips = async () => {
    if (!order || busy) return
    setBusy(true)
    try {
      await useOrderStore.getState().editPaidOrder(order.id, { tips: tipsValue })
      useUiStore.getState().toastSuccess('Чаевые сохранены')
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onAddItems = () => {
    if (!order) return
    onClose?.()
    navigate(`/order-builder?add_to_order=${encodeURIComponent(order.id)}`)
  }

  const onPay = async () => {
    if (!order || busy) return
    const ui = useUiStore.getState()
    const amountLabel = formatMoney(orderTotal, currency)
    const tipsLine =
      tipsValue > 0
        ? ` Чаевые ${formatMoney(tipsValue, currency)} будут записаны отдельно.`
        : ''
    const ok = await ui.confirm({
      title: 'Подтвердить оплату?',
      message: `К оплате: ${amountLabel}.${tipsLine} После подтверждения заказ закроется и стол освободится.`,
      confirmText: 'Подтвердить',
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().payOrder(order.id, { tips: tipsValue })
      ui.toastSuccess('Заказ оплачен')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onMove = () => {
    if (!order) return
    setMovePickerVisible(true)
  }

  // Pick a target table to move (or detach) the order.
  const onPickMoveTable = async (tableId) => {
    setMovePickerVisible(false)
    if (!order) return
    setBusy(true)
    try {
      const updated = await useOrderStore.getState().moveOrder(order.id, tableId)
      useUiStore
        .getState()
        .toastSuccess(
          tableId
            ? `Перенесено · стол №${updated.table_number}`
            : 'Заказ откреплён от стола',
        )
      onClose?.()
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    if (!order) return
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить заказ?',
      message: 'Стол освободится. Действие нельзя отменить.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useOrderStore.getState().deleteOrder(order.id)
      ui.toastSuccess('Заказ удалён')
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  // Single order line (shared by flat list and per-guest groups).
  const renderOrderItem = (i) => (
    <li key={i.id} className={i.served ? 'ods-item ods-item--served' : 'ods-item'}>
      <button
        className={i.served ? 'ods-served ods-served--on' : 'ods-served'}
        aria-label={i.served ? 'Не подано' : 'Подано'}
        onClick={() => onToggleServed(i)}
      >
        {i.served && (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="ods-item-main">
        <div className="ods-item-title">
          <span>{i.title}</span>
          <span className="ods-item-qty">× {i.quantity}</span>
        </div>
        {i.comment && <div className="ods-item-comment">💬 {i.comment}</div>}
      </div>
      <div className="ods-item-price">{formatMoney(i.total_price, currency)}</div>
      {!paidMode && (
        <button
          className="ods-item-remove"
          disabled={busy}
          aria-label="Удалить позицию"
          onClick={() => onRemoveItem(i)}
        >
          ×
        </button>
      )}
    </li>
  )

  return (
    <>
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet ods-sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <div className="ods-header-main">
            <h3 className="sheet-title">
              {liveOrder?.table_number
                ? `Стол №${liveOrder.table_number}`
                : 'Заказ без стола'}
            </h3>
            {liveOrder && (
              <span className="ods-meta">
                {paidMode
                  ? `✓ Закрыт ${closedAtLabel} · ${formatMoney(liveOrder.total_price, currency)}`
                  : `⏱ ${openedAgo} · ${formatMoney(liveOrder.total_price, currency)}`}
              </span>
            )}
          </div>
          <button className="sheet-close" onClick={() => onClose?.()}>
            ×
          </button>
        </header>

        <div className="ods-content">
          {liveOrder?.comments && (
            <div className="ods-comments">
              <span className="ods-comments-label">💬 Комментарий</span>
              <p>{liveOrder.comments}</p>
            </div>
          )}

          {orderItems.length > 0 ? (
            guestsCount <= 1 ? (
              <ul className="ods-items">{orderItems.map(renderOrderItem)}</ul>
            ) : (
              Array.from({ length: guestsCount }, (_, gi) => gi + 1).map((g) => {
                const guestItems = orderItems.filter((it) => (it.guest || 1) === g)
                if (guestItems.length === 0) return null
                const subtotal = guestItems.reduce((s, it) => s + (it.total_price || 0), 0)
                return (
                  <div className="cc-guest-group" key={g}>
                    <div className="cc-guest-head">
                      <span className="cc-guest-name">
                        <span className="cc-guest-badge">{g}</span>
                        Гость {g}
                      </span>
                      <span className="cc-guest-subtotal">
                        {formatMoney(subtotal, currency)}
                      </span>
                    </div>
                    <ul className="ods-items">{guestItems.map(renderOrderItem)}</ul>
                  </div>
                )
              })
            )
          ) : (
            liveOrder && (
              <div className="ods-empty-items">
                <p>В этом заказе пока нет позиций.</p>
              </div>
            )
          )}

          {orderItems.length > 0 && (
            <div className="ods-tips-row">
              <label className="ods-tips-label">Чаевые</label>
              <div className="ods-tips-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="0"
                  className="ods-tips-input"
                  value={tipsAmount}
                  onChange={(e) => setTipsAmount(e.target.value)}
                />
                <span className="ods-tips-currency">{currency}</span>
              </div>
              {tipsDirty && (
                <button
                  className="ods-tips-save"
                  onClick={onSaveTips}
                  disabled={busy}
                >
                  {busy ? '…' : 'Сохранить'}
                </button>
              )}
            </div>
          )}

          {orderItems.length > 0 && (
            <div className="ods-totals">
              <div className="ods-totals-row">
                <span>Заказ</span>
                <span className="ods-totals-value">
                  {formatMoney(orderTotal, currency)}
                </span>
              </div>
              {paidTips > 0 && (
                <div className="ods-totals-row ods-totals-row--small">
                  <span>Чаевые (отдельно)</span>
                  <span className="ods-totals-value">
                    {formatMoney(paidTips, currency)}
                  </span>
                </div>
              )}
              <div className="ods-totals-row ods-totals-row--main">
                <span>{paidMode ? 'Итого по заказу' : 'К оплате'}</span>
                <span className="ods-totals-value">
                  {formatMoney(orderTotal, currency)}
                </span>
              </div>
            </div>
          )}
        </div>

        {!paidMode ? (
          <>
            <footer className="ods-footer">
              <button className="btn btn--ghost" onClick={onAddItems} disabled={busy}>
                + Позиции
              </button>
              <button
                className="btn btn--primary"
                disabled={busy || !canPay}
                onClick={onPay}
              >
                {busy ? '…' : 'Оплатить'}
              </button>
            </footer>
            <div className="ods-more">
              <button className="ods-more-btn" onClick={onMove} disabled={busy}>
                Перенести на другой стол
              </button>
              <button
                className="ods-more-btn ods-more-btn--danger"
                onClick={onDelete}
                disabled={busy}
              >
                Удалить заказ
              </button>
            </div>
          </>
        ) : (
          <footer className="ods-footer">
            <button
              className="btn btn--ghost"
              onClick={() => onEdit?.(order)}
              disabled={busy}
            >
              ✏️ Изменить
            </button>
            <button
              className="btn btn--primary"
              onClick={() => onReopen?.(order)}
              disabled={busy}
            >
              ↩ Вернуть в активные
            </button>
          </footer>
        )}
      </div>
    </div>

    <TablePickerSheet
      visible={movePickerVisible}
      currentTableId={order?.table_id || null}
      freeOnly={true}
      onClose={() => setMovePickerVisible(false)}
      onSelect={onPickMoveTable}
    />
    </>
  )
}
WN_TOOLS_EOF

# ---- src/stores/order.js ----
cat > "src/stores/order.js" <<'WN_TOOLS_EOF'
import { create } from 'zustand'
import { ordersApi } from '@/api/orders'
import { newId } from '@/utils/nanoid'
import { useShiftStore } from './shift'
import { useHallStore } from './hall'

/**
 * Order store: orders of the current shift + cart draft.
 *
 * The cart (draft) is a single in-memory object built by OrderBuilder.
 * It survives navigation but is cleared when the shift closes / workplace
 * switches. Persistence: survives reload via a localStorage key, so
 * reopening the app continues the cart you were filling.
 *
 * ── Porting notes ───────────────────────────────────────────────────
 * 1. CROSS-STORE: in Vue this called useShiftStore()/useHallStore() inside
 *    actions. Here we use the static getState():
 *        useShiftStore.getState().current
 *        useHallStore.getState().tableById(id)
 *        useHallStore.getState().patchTableLocal(id, patch)
 *
 * 2. IMMUTABLE DRAFT: this is the most mutation-heavy store in the Vue app
 *    — it did `existing.quantity += n`, `Object.assign(item, patch)`,
 *    `draft.items.push(...)`. Zustand state must never be mutated in place,
 *    or components won't re-render. Every draft op below rebuilds the
 *    draft object: change items via .map()/.filter()/[...spread], then
 *    set({ draft: next }) and persist. The helper `setDraft(next)` does
 *    both (set state + persist) to keep this consistent.
 *
 * 3. getters that take a param (orderByTable, orderById,
 *    draftQuantityOfMenuItem) are plain methods. In components, select raw
 *    state (s => s.orders / s => s.draft) and derive with useMemo.
 * ─────────────────────────────────────────────────────────────────────
 */

const DRAFT_STORAGE_KEY = 'waiter-note:cart-draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistDraft(draft) {
  try {
    if (draft) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  } catch {
    /* quota exceeded — drop silently */
  }
}

export const useOrderStore = create((set, get) => ({
  // === Server state ===
  orders: [], // orders of the *current* shift, with items
  isLoading: false,
  error: null,

  // === Cart draft ===
  // Shape: { tableId, hallId, items: [{ id, menu_item_id, title, price,
  //          quantity, comment }], comments }
  draft: loadDraft(),

  // Internal helper: persist a draft AND update the store in one place.
  // Pass null to clear. Keeps the "always persist on change" invariant.
  _setDraft: (next) => {
    persistDraft(next)
    set({ draft: next })
  },

  // === getters: orders (were: computed) ===

  activeOrders: () => get().orders.filter((o) => !o.is_paid),
  paidOrders: () => get().orders.filter((o) => o.is_paid),

  /** Order currently attached to a specific table (active only). */
  orderByTable: (tableId) =>
    get().activeOrders().find((o) => o.table_id === tableId) || null,

  orderById: (id) => get().orders.find((o) => o.id === id) || null,

  /** Sum of total_price across active orders (live aggregate). */
  activeRevenue: () =>
    get().activeOrders().reduce((s, o) => s + (o.total_price || 0), 0),

  // === getters: draft ===

  draftIsEmpty: () => {
    const d = get().draft
    return !d || d.items.length === 0
  },

  draftItemCount: () => {
    const d = get().draft
    return d ? d.items.reduce((s, i) => s + i.quantity, 0) : 0
  },

  draftTotal: () => {
    const d = get().draft
    return d ? d.items.reduce((s, i) => s + i.price * i.quantity, 0) : 0
  },

  /**
   * Quantity of a specific menu item in the draft (for badges on menu
   * cards). Multiple draft entries with same menu_item_id are summed.
   */
  draftQuantityOfMenuItem: (menuItemId) => {
    const d = get().draft
    if (!d) return 0
    return d.items
      .filter((i) => i.menu_item_id === menuItemId)
      .reduce((s, i) => s + i.quantity, 0)
  },

  // === actions: server ===

  fetchForCurrentShift: async () => {
    const shift = useShiftStore.getState().current
    if (!shift?.id) {
      set({ orders: [] })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const orders = await ordersApi.listForShift(shift.id)
      set({ orders })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  /**
   * Submit the draft as a new order in the current shift.
   * On success: clears draft, prepends order, updates table/shift caches.
   */
  submitDraft: async ({ workplaceId }) => {
    const draft = get().draft
    if (!draft || draft.items.length === 0) {
      throw new Error('Корзина пуста')
    }
    const body = {
      id: newId(),
      table_id: draft.tableId,
      comments: draft.comments || null,
      guests_count: draft.guestCount || 1,
      items: draft.items.map((i) => ({
        id: newId(),
        menu_item_id: i.menu_item_id,
        title: i.title,
        price: i.price,
        quantity: i.quantity,
        comment: i.comment || null,
        guest: i.guest || 1,
      })),
    }
    const order = await ordersApi.createInCurrentShift(workplaceId, body)
    set({ orders: [order, ...get().orders] })
    get().syncTableCache(order)
    get().clearDraft()
    return order
  },

  /**
   * Update Hall store cache: when an order is created/moved/paid, the
   * table's order_id and status need to match.
   *
   * Status policy (mirrors backend recompute):
   *   - No items / some items not served → "waiting" (yellow)
   *   - All items served                 → "occupied" (red, ready to pay)
   */
  syncTableCache: (order) => {
    if (!order.table_id) return
    const hall = useHallStore.getState()
    const t = hall.tableById(order.table_id)
    if (t) {
      const items = order.items || []
      const allServed = items.length > 0 && items.every((i) => i.served)
      hall.patchTableLocal(t.id, {
        order_id: order.id,
        status: allServed ? 'occupied' : 'waiting',
      })
    }
  },

  syncTableCacheCleared: (orderId, tableId) => {
    if (!tableId) return
    const hall = useHallStore.getState()
    const t = hall.tableById(tableId)
    if (t && t.order_id === orderId) {
      hall.patchTableLocal(t.id, { order_id: null, status: 'free' })
    }
  },

  addItemsToOrder: async (orderId, items) => {
    const newItems = items.map((i) => ({
      id: newId(),
      menu_item_id: i.menu_item_id,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
      comment: i.comment || null,
      guest: i.guest || 1,
    }))
    const updated = await ordersApi.addItems(orderId, newItems)
    get().replaceLocal(updated)
    get().syncTableCache(updated)
    return updated
  },

  updateOrderItem: async (itemId, patch) => {
    const updated = await ordersApi.updateItem(itemId, patch)
    get().replaceLocal(updated)
    return updated
  },

  /**
   * Toggle the "served" flag on a single line item. Optimistic so the
   * checkbox feels instant; on server failure we revert and rethrow.
   */
  toggleItemServed: async (orderId, itemId) => {
    const ord = get().orderById(orderId)
    if (!ord) return null
    const item = (ord.items || []).find((i) => i.id === itemId)
    if (!item) return null

    const prev = !!item.served
    const next = !prev

    // Optimistic local flip — rebuild order immutably so the table recolors
    set({
      orders: get().orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((i) =>
                i.id === itemId ? { ...i, served: next } : i,
              ),
            }
          : o,
      ),
    })

    try {
      const updated = await ordersApi.updateItem(itemId, { served: next })
      get().replaceLocal(updated)
      return updated
    } catch (e) {
      // Revert on failure
      set({
        orders: get().orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                items: o.items.map((i) =>
                  i.id === itemId ? { ...i, served: prev } : i,
                ),
              }
            : o,
        ),
      })
      throw e
    }
  },

  removeOrderItem: async (itemId) => {
    const updated = await ordersApi.removeItem(itemId)
    get().replaceLocal(updated)
    return updated
  },

  moveOrder: async (orderId, newTableId) => {
    const order = get().orderById(orderId)
    const prevTableId = order?.table_id || null
    const updated = await ordersApi.move(orderId, newTableId)
    get().replaceLocal(updated)
    if (prevTableId && prevTableId !== newTableId) {
      get().syncTableCacheCleared(orderId, prevTableId)
    }
    get().syncTableCache(updated)
    return updated
  },

  payOrder: async (orderId, { tips = 0 } = {}) => {
    const updated = await ordersApi.pay(orderId, { tips })
    const tableId = updated.table_id
    get().replaceLocal(updated)
    get().syncTableCacheCleared(orderId, tableId)

    // Re-fetch current shift so dashboard aggregates update.
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  /**
   * Reopen a previously paid order. Returns to active state, table (if any)
   * re-attached, shift aggregates recomputed server-side.
   */
  reopenOrder: async (orderId) => {
    const updated = await ordersApi.reopen(orderId)
    get().replaceLocal(updated)
    // Quick local table sync.
    if (updated.table_id) {
      const hall = useHallStore.getState()
      const t = hall.tableById(updated.table_id)
      if (t) {
        hall.patchTableLocal(t.id, {
          order_id: updated.id,
          status: (updated.items?.length || 0) > 0 ? 'occupied' : 'waiting',
        })
      }
    }
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  /**
   * Edit a paid order's items / tips / comments. Server validates the
   * shift is open and the user is the shift owner.
   */
  editPaidOrder: async (orderId, patch) => {
    const updated = await ordersApi.editPaid(orderId, patch)
    get().replaceLocal(updated)
    const shift = useShiftStore.getState()
    if (shift.current?.id === updated.shift_id) {
      shift
        .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
        .catch(() => {})
    }
    return updated
  },

  deleteOrder: async (orderId) => {
    const order = get().orderById(orderId)
    const tableId = order?.table_id || null
    const wasPaid = order?.is_paid || false
    await ordersApi.remove(orderId)
    set({ orders: get().orders.filter((o) => o.id !== orderId) })
    get().syncTableCacheCleared(orderId, tableId)

    if (wasPaid) {
      const shift = useShiftStore.getState()
      if (order && shift.current?.id === order.shift_id) {
        shift
          .fetchCurrent(useHallStore.getState().halls[0]?.workplace_id || null)
          .catch(() => {})
      }
    }
  },

  /**
   * Drop a fresh server snapshot of an order into local state. Also syncs
   * the bound table's status — without this, served-toggling and item
   * removal don't recolor the table on the map.
   */
  replaceLocal: (order) => {
    const orders = get().orders
    const idx = orders.findIndex((o) => o.id === order.id)
    if (idx >= 0) {
      set({ orders: orders.map((o) => (o.id === order.id ? order : o)) })
    } else {
      set({ orders: [order, ...orders] })
    }
    // Sync table cache too, unless the order is now paid — paid orders
    // detach from the table, handled by syncTableCacheCleared at the call
    // site (payOrder / deleteOrder).
    if (!order.is_paid && order.table_id) {
      get().syncTableCache(order)
    }
  },

  // === actions: draft (all immutable — rebuild + _setDraft) ===

  /** Initialize a fresh draft. Optionally pre-select a table. */
  startDraft: ({ tableId = null, hallId = null } = {}) => {
    get()._setDraft({ tableId, hallId, items: [], comments: '', guestCount: 1 })
  },

  /**
   * Replace the draft with a snapshot of a paid order, for the "edit paid
   * order" flow. Held in memory only — NOT persisted (one-shot edit).
   */
  replaceDraftWithPaidOrder: (order) => {
    // Note: ephemeral — set state but DON'T persist.
    set({
      draft: {
        tableId: order.table_id || null,
        hallId: order.hall_id || null,
        items: (order.items || []).map((i) => ({
          id: i.id,
          menu_item_id: i.menu_item_id,
          title: i.title,
          price: Number(i.price),
          quantity: Number(i.quantity),
          comment: i.comment || null,
          guest: i.guest || 1,
        })),
        comments: order.comments || '',
        guestCount: order.guests_count || 1,
      },
    })
  },

  /**
   * Start an empty ephemeral draft pinned to a table. Used by the
   * "add items to active order" flow. Ephemeral — not persisted.
   */
  replaceDraftEphemeral: ({ tableId = null, hallId = null, guestsCount = 1 } = {}) => {
    set({ draft: { tableId, hallId, items: [], comments: '', guestCount: guestsCount || 1 } })
  },

  /**
   * Add a menu item to the draft. If it already exists with the SAME
   * comment, increment quantity; otherwise add a new line.
   */
  addToDraft: (menuItem, { comment = null, quantity = 1, guest = 1 } = {}) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    // Same item + same comment + same guest → bump quantity; else new line.
    const existing = d.items.find(
      (i) =>
        i.menu_item_id === menuItem.id &&
        (i.comment || null) === (comment || null) &&
        (i.guest || 1) === guest,
    )
    let items
    if (existing) {
      items = d.items.map((i) =>
        i === existing ? { ...i, quantity: i.quantity + quantity } : i,
      )
    } else {
      items = [
        ...d.items,
        {
          id: newId(),
          menu_item_id: menuItem.id,
          title: menuItem.title,
          price: menuItem.price,
          quantity,
          comment,
          guest,
        },
      ]
    }
    get()._setDraft({ ...d, items })
  },

  updateDraftItem: (itemId, patch) => {
    const d = get().draft
    if (!d) return
    const target = d.items.find((i) => i.id === itemId)
    if (!target) return
    const merged = { ...target, ...patch }
    if (merged.quantity <= 0) {
      get().removeDraftItem(itemId)
    } else {
      get()._setDraft({
        ...d,
        items: d.items.map((i) => (i.id === itemId ? merged : i)),
      })
    }
  },

  incDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    get()._setDraft({
      ...d,
      items: d.items.map((i) =>
        i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    })
  },

  decDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    const item = d.items.find((i) => i.id === itemId)
    if (!item) return
    if (item.quantity <= 1) {
      get().removeDraftItem(itemId)
    } else {
      get()._setDraft({
        ...d,
        items: d.items.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i,
        ),
      })
    }
  },

  removeDraftItem: (itemId) => {
    const d = get().draft
    if (!d) return
    get()._setDraft({ ...d, items: d.items.filter((i) => i.id !== itemId) })
  },

  /**
   * Empty the cart's items but KEEP the rest of the draft — table, hall,
   * guest count and comments stay. Used by "Очистить корзину": only the
   * dish positions are removed, the chosen number of guests remains.
   */
  clearDraftItems: () => {
    const d = get().draft
    if (!d) return
    get()._setDraft({ ...d, items: [] })
  },

  setDraftTable: (tableId, hallId) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    get()._setDraft({ ...d, tableId, hallId })
  },

  setDraftComments: (comments) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    get()._setDraft({ ...d, comments })
  },

  // === actions: guests (split a draft across 1..10 guests; 1 = single bill) ===

  /** Set guest count (clamped 1..10). Used by the initial "how many guests" pick. */
  setGuestCount: (n) => {
    let d = get().draft
    if (!d) d = { tableId: null, hallId: null, items: [], comments: '', guestCount: 1 }
    const count = Math.max(1, Math.min(10, n | 0))
    get()._setDraft({ ...d, guestCount: count })
  },

  /** Add one guest (up to 10). */
  addGuest: () => {
    const d = get().draft
    if (!d) return
    if ((d.guestCount || 1) >= 10) return
    get()._setDraft({ ...d, guestCount: (d.guestCount || 1) + 1 })
  },

  /**
   * Remove guest `g`: drop that guest's items and renumber the rest so the
   * sequence stays 1..N (guest 3 becomes 2, etc.). Min count is 1.
   */
  removeGuest: (g) => {
    const d = get().draft
    if (!d) return
    const count = d.guestCount || 1
    if (count <= 1) return
    const items = d.items
      .filter((i) => (i.guest || 1) !== g)
      .map((i) => ((i.guest || 1) > g ? { ...i, guest: i.guest - 1 } : i))
    get()._setDraft({ ...d, items, guestCount: count - 1 })
  },

  clearDraft: () => {
    get()._setDraft(null)
  },

  /**
   * Drop draft items whose menu_item_id is not in the supplied set of
   * currently-known menu item IDs. Used after the menu loads to reconcile
   * a persisted draft against the live catalogue.
   * Returns the number of items removed so the caller can toast.
   */
  reconcileDraftWithMenu: (validMenuItemIds) => {
    const d = get().draft
    if (!d || !d.items?.length) return 0
    const valid = new Set(validMenuItemIds)
    const before = d.items.length
    const kept = d.items.filter((i) => valid.has(i.menu_item_id))
    const removed = before - kept.length
    if (removed === 0) return 0

    if (kept.length === 0) {
      get().clearDraft()
    } else {
      get()._setDraft({ ...d, items: kept })
    }
    return removed
  },

  reset: () => {
    set({ orders: [], error: null })
    get().clearDraft()
  },
}))
WN_TOOLS_EOF

# ---- src/stores/ui.js ----
cat > "src/stores/ui.js" <<'WN_TOOLS_EOF'
import { create } from 'zustand'
import { hapticNotification } from '@/utils/telegram'

let toastSeq = 0
let promptSeq = 0

/**
 * UI store: ephemeral state shared across views.
 * - toasts: stack of short notifications
 * - confirm: a single pending confirm dialog (Promise-based)
 * - prompt: a single pending text-input dialog (Promise-based)
 *
 * ── Porting note: immutable updates ─────────────────────────────────
 * In Vue we mutated arrays in place: toasts.value.push(t). Zustand state
 * is immutable like React — never mutate, always replace:
 *     push   → set({ toasts: [...get().toasts, t] })
 *     filter → set({ toasts: get().toasts.filter(...) })
 * Same rule you'd follow with useState. The Promise-based confirm/prompt
 * pattern carries over unchanged — the dialog object just lives in state.
 * ─────────────────────────────────────────────────────────────────────
 */
export const useUiStore = create((set, get) => ({
  toasts: [],
  confirmDialog: null,
  promptDialog: null,
  diagnosticsOpen: false,
  // Number of full-screen sheets/overlays currently open (e.g. the order
  // details sheet). The floating "Взять заказ" CTA hides while > 0 so it
  // can't overlap or be tapped through the sheet's own buttons.
  overlayCount: 0,

  pushOverlay: () => set({ overlayCount: get().overlayCount + 1 }),
  popOverlay: () => set({ overlayCount: Math.max(0, get().overlayCount - 1) }),

  /**
   * Show a toast. type: 'success' | 'error' | 'info' | 'warning'
   * Optional `action`: { label, handler } adds a tappable link next to
   * the message. Returns the toast id so callers can dismiss it early.
   */
  toast: (message, { type = 'info', duration = 3000, action = null } = {}) => {
    const id = ++toastSeq
    set({ toasts: [...get().toasts, { id, message, type, action }] })

    if (type === 'success') hapticNotification('success')
    else if (type === 'error') hapticNotification('error')
    else if (type === 'warning') hapticNotification('warning')

    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration)
    }
    return id
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  // === Diagnostics panel (globally openable from any toast) ===
  openDiagnostics: () => set({ diagnosticsOpen: true }),
  closeDiagnostics: () => set({ diagnosticsOpen: false }),

  // Convenience helpers
  toastSuccess: (msg, opts) => get().toast(msg, { ...opts, type: 'success' }),
  // Errors are sticky-ish (5s) and offer a "Логи" link so the user can
  // surface diagnostic info to support when we can't reproduce the issue.
  toastError: (msg, opts) =>
    get().toast(msg, {
      duration: 5000,
      ...opts,
      type: 'error',
      action: opts?.action ?? {
        label: 'Логи',
        handler: () => get().openDiagnostics(),
      },
    }),
  toastInfo: (msg, opts) => get().toast(msg, { ...opts, type: 'info' }),
  toastWarning: (msg, opts) => get().toast(msg, { ...opts, type: 'warning' }),

  /**
   * Promise-based confirm dialog. The ConfirmDialog component renders from
   * confirmDialog state and calls resolveConfirm() when the user picks.
   */
  confirm: ({
    title = 'Подтвердите',
    message = '',
    confirmText = 'OK',
    cancelText = 'Отмена',
    danger = false,
  } = {}) =>
    new Promise((resolve) => {
      set({
        confirmDialog: {
          title,
          message,
          confirmText,
          cancelText,
          danger,
          resolve,
        },
      })
    }),

  resolveConfirm: (result) => {
    const dialog = get().confirmDialog
    if (!dialog) return
    dialog.resolve(result)
    set({ confirmDialog: null })
  },

  /**
   * Promise-based text-input dialog. Returns the entered string on confirm,
   * or null if the user cancelled.
   */
  prompt: ({
    title = 'Введите значение',
    initial = '',
    placeholder = '',
    multiline = false,
    rows = 4,
    inputType = 'text',
    inputMode = 'text',
    maxLength = 2000,
    confirmText = 'Сохранить',
    cancelText = 'Отмена',
    required = false,
  } = {}) =>
    new Promise((resolve) => {
      set({
        promptDialog: {
          // Unique per-open token — lets the PromptHost component use it as a
          // React key so the modal remounts (and reseeds its input) on each
          // new prompt. Cheaper/cleaner than tagging the object later.
          _token: ++promptSeq,
          title,
          initial,
          placeholder,
          multiline,
          rows,
          inputType,
          inputMode,
          maxLength,
          confirmText,
          cancelText,
          required,
          resolve,
        },
      })
    }),

  resolvePrompt: (result) => {
    const dialog = get().promptDialog
    if (!dialog) return
    dialog.resolve(result)
    set({ promptDialog: null })
  },
}))
WN_TOOLS_EOF

# ---- src/mocks/handlers.js ----
cat > "src/mocks/handlers.js" <<'WN_TOOLS_EOF'
/**
 * Mock backend handlers. Each function mirrors a real endpoint.
 * Throws ApiError just like axios interceptors would, so stores
 * don't see any difference between mock and real backend.
 *
 * NOTE: framework-agnostic plain JS — ported verbatim from the Vue project.
 */
import { db, tx, ensureMe } from './db'
import { ApiError } from '@/api/client'
import { newId } from '@/utils/nanoid'

// =====================
// Helpers
// =====================

const NETWORK_DELAY_MIN = 80
const NETWORK_DELAY_MAX = 220

function utcTs() {
  return Math.floor(Date.now() / 1000)
}

function delay() {
  const ms = NETWORK_DELAY_MIN + Math.random() * (NETWORK_DELAY_MAX - NETWORK_DELAY_MIN)
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function notFound(what) {
  return new ApiError(`${what} не найдено`, { status: 404, detail: 'not found' })
}
function conflict(message) {
  return new ApiError(message, { status: 409, detail: message })
}
function badRequest(message) {
  return new ApiError(message, { status: 400, detail: message })
}
function forbidden(message) {
  return new ApiError(message, { status: 403, detail: message })
}

function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj))
}

function find(list, id) {
  return list.find((x) => x.id === id)
}

function cryptoRandomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
  let s = ''
  for (let i = 0; i < 21; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function round2(x) {
  return Math.round(x * 100) / 100
}

function hasAccess(workplaceId, userId) {
  return db.workplace_members.some(
    (m) => m.workplace_id === workplaceId && m.user_id === userId,
  )
}

function getRole(workplaceId, userId) {
  const m = db.workplace_members.find(
    (x) => x.workplace_id === workplaceId && x.user_id === userId,
  )
  return m ? m.role : null
}

// =====================
// /me
// =====================

export async function getMe() {
  await delay()
  ensureMe()
  return clone(db.me)
}

export async function updateMe(patch) {
  await delay()
  ensureMe()
  const allowed = ['language', 'timezone', 'is_onboarding_completed', 'accent_key', 'theme']
  tx(() => {
    for (const k of allowed) {
      if (patch[k] !== undefined) db.me[k] = patch[k]
    }
    db.me.updated_at = utcTs()
  })
  return clone(db.me)
}

// =====================
// Workplaces
// =====================

function workplaceWithRole(w, userId) {
  return { ...clone(w), my_role: getRole(w.id, userId) || 'member' }
}

export async function listWorkplaces({ includeArchived = false } = {}) {
  await delay()
  const me = ensureMe()
  const myMemberships = db.workplace_members.filter((m) => m.user_id === me.id)
  const workplaceIds = new Set(myMemberships.map((m) => m.workplace_id))
  let list = db.workplaces.filter((w) => workplaceIds.has(w.id))
  if (!includeArchived) list = list.filter((w) => !w.is_archived)
  list.sort((a, b) => a.position - b.position)
  return list.map((w) => workplaceWithRole(w, me.id))
}

export async function getWorkplace(id) {
  await delay()
  const me = ensureMe()
  const w = find(db.workplaces, id)
  if (!w || !hasAccess(id, me.id)) throw notFound('Заведение')
  return workplaceWithRole(w, me.id)
}

export async function createWorkplace(body) {
  await delay()
  const me = ensureMe()
  if (find(db.workplaces, body.id)) throw conflict('Workplace с таким id уже существует')

  const ownPositions = db.workplaces
    .filter((w) => w.owner_id === me.id)
    .map((w) => w.position)
  const maxPos = ownPositions.length ? Math.max(...ownPositions) : -1

  const now = utcTs()
  const wp = {
    id: body.id,
    owner_id: me.id,
    title: body.title,
    timezone: body.timezone,
    currency: body.currency,
    service_percent_default: body.service_percent_default,
    shift_type_default: body.shift_type_default,
    pay_for_shift_default: body.pay_for_shift_default,
    position: maxPos + 1,
    is_archived: false,
    created_at: now,
    updated_at: now,
  }

  tx(() => {
    db.workplaces.push(wp)
    db.workplace_members.push({
      id: cryptoRandomId(),
      workplace_id: wp.id,
      user_id: me.id,
      role: 'owner',
      joined_at: now,
    })
    db.me.last_workplace_id = wp.id
    db.me.updated_at = now
  })

  return workplaceWithRole(wp, me.id)
}

export async function updateWorkplace(id, patch) {
  await delay()
  const me = ensureMe()
  const w = find(db.workplaces, id)
  if (!w || !hasAccess(id, me.id)) throw notFound('Заведение')

  const allowed = [
    'title', 'timezone', 'currency',
    'service_percent_default', 'shift_type_default', 'pay_for_shift_default',
  ]
  tx(() => {
    for (const k of allowed) {
      if (patch[k] !== undefined) w[k] = patch[k]
    }
    w.updated_at = utcTs()
  })
  return workplaceWithRole(w, me.id)
}

export async function archiveWorkplace(id) {
  return setWorkplaceArchived(id, true)
}
export async function unarchiveWorkplace(id) {
  return setWorkplaceArchived(id, false)
}

async function setWorkplaceArchived(id, value) {
  await delay()
  const me = ensureMe()
  const w = find(db.workplaces, id)
  if (!w || !hasAccess(id, me.id)) throw notFound('Заведение')
  if (w.owner_id !== me.id) throw forbidden('owner access required')
  tx(() => {
    w.is_archived = value
    w.updated_at = utcTs()
  })
  return workplaceWithRole(w, me.id)
}

export async function deleteWorkplace(id) {
  await delay()
  const me = ensureMe()
  const w = find(db.workplaces, id)
  if (!w || !hasAccess(id, me.id)) throw notFound('Заведение')
  if (w.owner_id !== me.id) throw forbidden('owner access required')
  tx(() => {
    cascadeDeleteWorkplace(id)
    if (db.me.last_workplace_id === id) db.me.last_workplace_id = null
  })
}

function cascadeDeleteWorkplace(workplaceId) {
  const hallIds = db.halls.filter((h) => h.workplace_id === workplaceId).map((h) => h.id)
  const tableIds = db.tables.filter((t) => hallIds.includes(t.hall_id)).map((t) => t.id)
  const catIds = db.menu_categories
    .filter((c) => c.workplace_id === workplaceId)
    .map((c) => c.id)
  const itemIds = db.menu_items.filter((i) => catIds.includes(i.category_id)).map((i) => i.id)
  const shiftIds = db.shifts.filter((s) => s.workplace_id === workplaceId).map((s) => s.id)
  const orderIds = db.orders.filter((o) => shiftIds.includes(o.shift_id)).map((o) => o.id)
  const layoutIds = db.hall_layouts.filter((l) => hallIds.includes(l.hall_id)).map((l) => l.id)

  db.table_positions = db.table_positions.filter((p) => !layoutIds.includes(p.layout_id))
  db.hall_layouts = db.hall_layouts.filter((l) => !layoutIds.includes(l.id))
  db.tables = db.tables.filter((t) => !tableIds.includes(t.id))
  db.halls = db.halls.filter((h) => !hallIds.includes(h.id))
  db.menu_items = db.menu_items.filter((i) => !itemIds.includes(i.id))
  db.menu_categories = db.menu_categories.filter((c) => !catIds.includes(c.id))
  db.order_items = db.order_items.filter((oi) => !orderIds.includes(oi.order_id))
  db.orders = db.orders.filter((o) => !orderIds.includes(o.id))
  db.shifts = db.shifts.filter((s) => !shiftIds.includes(s.id))
  db.notes = db.notes.filter(
    (n) => n.workplace_id !== workplaceId && !shiftIds.includes(n.shift_id),
  )
  db.workplace_members = db.workplace_members.filter((m) => m.workplace_id !== workplaceId)
  db.workplaces = db.workplaces.filter((w) => w.id !== workplaceId)
}

export async function reorderWorkplaces(ids) {
  await delay()
  const me = ensureMe()
  tx(() => {
    let pos = 0
    for (const id of ids) {
      const w = find(db.workplaces, id)
      if (w && w.owner_id === me.id) {
        w.position = pos++
        w.updated_at = utcTs()
      }
    }
  })
}

export async function selectWorkplace(id) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(id, me.id)) throw notFound('Заведение')
  tx(() => {
    db.me.last_workplace_id = id
    db.me.updated_at = utcTs()
  })
}

// =====================
// Halls + Tables
// =====================

function tablesOfHall(hallId) {
  return db.tables.filter((t) => t.hall_id === hallId).map(clone)
}

function hallWithTables(h) {
  const cloned = clone(h)
  cloned.tables = tablesOfHall(h.id)
  return cloned
}

export async function listHalls(workplaceId) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  const halls = db.halls
    .filter((h) => h.workplace_id === workplaceId)
    .sort((a, b) => a.position - b.position)
  return halls.map(hallWithTables)
}

export async function createHall(workplaceId, body) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  if (find(db.halls, body.id)) throw conflict('Hall id already exists')

  const positions = db.halls
    .filter((h) => h.workplace_id === workplaceId)
    .map((h) => h.position)
  const maxPos = positions.length ? Math.max(...positions) : -1

  const hall = {
    id: body.id,
    workplace_id: workplaceId,
    name: body.name,
    width: body.width,
    height: body.height,
    scale: body.scale,
    position: maxPos + 1,
  }
  tx(() => db.halls.push(hall))
  return hallWithTables(hall)
}

export async function getHall(hallId) {
  await delay()
  const me = ensureMe()
  const h = find(db.halls, hallId)
  if (!h || !hasAccess(h.workplace_id, me.id)) throw notFound('Зал')
  return hallWithTables(h)
}

export async function updateHall(hallId, patch) {
  await delay()
  const me = ensureMe()
  const h = find(db.halls, hallId)
  if (!h || !hasAccess(h.workplace_id, me.id)) throw notFound('Зал')
  const allowed = ['name', 'width', 'height', 'scale']
  tx(() => {
    for (const k of allowed) if (patch[k] !== undefined) h[k] = patch[k]
  })
  return hallWithTables(h)
}

export async function deleteHall(hallId) {
  await delay()
  const me = ensureMe()
  const h = find(db.halls, hallId)
  if (!h || !hasAccess(h.workplace_id, me.id)) throw notFound('Зал')
  tx(() => {
    const tableIds = db.tables.filter((t) => t.hall_id === hallId).map((t) => t.id)
    db.tables = db.tables.filter((t) => t.hall_id !== hallId)
    for (const o of db.orders) {
      if (tableIds.includes(o.table_id)) {
        o.table_id = null
        o.hall_id = null
      }
    }
    const layoutIds = db.hall_layouts.filter((l) => l.hall_id === hallId).map((l) => l.id)
    db.table_positions = db.table_positions.filter((p) => !layoutIds.includes(p.layout_id))
    db.hall_layouts = db.hall_layouts.filter((l) => l.hall_id !== hallId)
    db.halls = db.halls.filter((x) => x.id !== hallId)
  })
}

export async function reorderHalls(workplaceId, ids) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  tx(() => {
    let pos = 0
    for (const id of ids) {
      const h = find(db.halls, id)
      if (h && h.workplace_id === workplaceId) h.position = pos++
    }
  })
}

export async function createTable(hallId, body) {
  await delay()
  const me = ensureMe()
  const hall = find(db.halls, hallId)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Зал')
  if (find(db.tables, body.id)) throw conflict('Table id already exists')

  const dup = db.tables.find((t) => t.hall_id === hallId && t.number === body.number)
  if (dup) throw conflict(`Стол №${body.number} уже существует в этом зале`)

  const table = {
    id: body.id,
    hall_id: hallId,
    order_id: null,
    number: body.number,
    x: body.x,
    y: body.y,
    width: body.width,
    height: body.height,
    rotation: body.rotation,
    border_radius: body.border_radius,
    status: 'free',
  }
  tx(() => db.tables.push(table))
  return clone(table)
}

export async function updateTable(tableId, patch) {
  await delay()
  const me = ensureMe()
  const t = find(db.tables, tableId)
  if (!t) throw notFound('Стол')
  const hall = find(db.halls, t.hall_id)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Стол')

  if (patch.number !== undefined && patch.number !== t.number) {
    const dup = db.tables.find(
      (x) => x.hall_id === t.hall_id && x.number === patch.number && x.id !== t.id,
    )
    if (dup) throw conflict(`Стол №${patch.number} уже существует`)
  }

  const allowed = ['number', 'x', 'y', 'width', 'height', 'rotation', 'border_radius', 'status']
  tx(() => {
    for (const k of allowed) if (patch[k] !== undefined) t[k] = patch[k]
  })
  return clone(t)
}

export async function deleteTable(tableId) {
  await delay()
  const me = ensureMe()
  const t = find(db.tables, tableId)
  if (!t) throw notFound('Стол')
  const hall = find(db.halls, t.hall_id)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Стол')
  tx(() => {
    for (const o of db.orders) {
      if (o.table_id === tableId) {
        o.table_id = null
      }
    }
    db.tables = db.tables.filter((x) => x.id !== tableId)
  })
}

// =====================
// Hall Layouts (Templates)
// =====================

function layoutWithPositions(layout) {
  const cloned = clone(layout)
  cloned.positions = db.table_positions
    .filter((p) => p.layout_id === layout.id)
    .sort((a, b) => a.table_number - b.table_number)
    .map(clone)
  return cloned
}

export async function listLayouts(hallId) {
  await delay()
  const me = ensureMe()
  const hall = find(db.halls, hallId)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Зал')
  return db.hall_layouts
    .filter((l) => l.hall_id === hallId)
    .sort((a, b) => a.created_at - b.created_at)
    .map(layoutWithPositions)
}

export async function createLayout(hallId, { id, name }) {
  await delay()
  const me = ensureMe()
  const hall = find(db.halls, hallId)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Зал')
  if (!id) throw badRequest('id is required')
  if (!name || !name.trim()) throw badRequest('name is required')

  const layoutId = id
  return tx(() => {
    const now = utcTs()
    const layout = {
      id: layoutId,
      hall_id: hallId,
      name: name.trim(),
      created_at: now,
      updated_at: now,
    }
    db.hall_layouts.push(layout)
    for (const t of db.tables.filter((x) => x.hall_id === hallId)) {
      db.table_positions.push({
        id: newId(),
        layout_id: layoutId,
        table_number: t.number,
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
        border_radius: t.border_radius,
      })
    }
    return layoutWithPositions(layout)
  })
}

export async function updateLayout(layoutId, { name }) {
  await delay()
  const me = ensureMe()
  const layout = find(db.hall_layouts, layoutId)
  if (!layout) throw notFound('Шаблон')
  const hall = find(db.halls, layout.hall_id)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Шаблон')
  if (!name || !name.trim()) throw badRequest('name is required')
  return tx(() => {
    layout.name = name.trim()
    layout.updated_at = utcTs()
    return layoutWithPositions(layout)
  })
}

export async function deleteLayout(layoutId) {
  await delay()
  const me = ensureMe()
  const layout = find(db.hall_layouts, layoutId)
  if (!layout) throw notFound('Шаблон')
  const hall = find(db.halls, layout.hall_id)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Шаблон')
  tx(() => {
    db.table_positions = db.table_positions.filter((p) => p.layout_id !== layoutId)
    db.hall_layouts = db.hall_layouts.filter((l) => l.id !== layoutId)
  })
}

export async function applyLayout(layoutId, { delete_extras = false, new_table_ids = {} } = {}) {
  await delay()
  const me = ensureMe()
  const layout = find(db.hall_layouts, layoutId)
  if (!layout) throw notFound('Шаблон')
  const hall = find(db.halls, layout.hall_id)
  if (!hall || !hasAccess(hall.workplace_id, me.id)) throw notFound('Шаблон')

  const positions = db.table_positions.filter((p) => p.layout_id === layoutId)
  const positionsByNumber = new Map(positions.map((p) => [p.table_number, p]))

  const moved = []
  const created = []
  const kept_extras = []
  const deleted_extras = []

  tx(() => {
    for (const pos of positions) {
      const existing = db.tables.find(
        (t) => t.hall_id === hall.id && t.number === pos.table_number,
      )
      if (existing) {
        existing.x = pos.x
        existing.y = pos.y
        existing.width = pos.width
        existing.height = pos.height
        existing.rotation = pos.rotation
        existing.border_radius = pos.border_radius
        moved.push(existing.id)
      } else {
        const tid = new_table_ids[pos.table_number] || newId()
        db.tables.push({
          id: tid,
          hall_id: hall.id,
          order_id: null,
          number: pos.table_number,
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          rotation: pos.rotation,
          border_radius: pos.border_radius,
          status: 'free',
        })
        created.push(tid)
      }
    }

    if (delete_extras) {
      const extras = db.tables.filter(
        (t) => t.hall_id === hall.id && !positionsByNumber.has(t.number),
      )
      for (const t of extras) {
        const hasActiveOrder =
          (t.order_id !== null && t.order_id !== undefined) ||
          db.orders.some((o) => o.table_id === t.id && !o.is_paid)
        if (hasActiveOrder) {
          kept_extras.push({ id: t.id, number: t.number, reason: 'active_order' })
        } else {
          for (const o of db.orders) {
            if (o.table_id === t.id) o.table_id = null
          }
          db.tables = db.tables.filter((x) => x.id !== t.id)
          deleted_extras.push(t.id)
        }
      }
    }
  })

  return { moved, created, kept_extras, deleted_extras }
}

// =====================
// Menu
// =====================

function itemsOfCategory(catId) {
  return db.menu_items
    .filter((i) => i.category_id === catId)
    .sort((a, b) => a.position - b.position)
    .map(clone)
}

function categoryWithItems(c, { activeOnly = false } = {}) {
  const cloned = clone(c)
  let items = itemsOfCategory(c.id)
  if (activeOnly) items = items.filter((i) => i.is_active)
  cloned.items = items
  return cloned
}

export async function getMenuTree(workplaceId, { activeOnly = false } = {}) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  let cats = db.menu_categories
    .filter((c) => c.workplace_id === workplaceId)
    .sort((a, b) => a.position - b.position)
  if (activeOnly) cats = cats.filter((c) => c.is_active)
  return cats.map((c) => categoryWithItems(c, { activeOnly }))
}

export async function createCategory(workplaceId, body) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  if (find(db.menu_categories, body.id)) throw conflict('Category id already exists')
  const positions = db.menu_categories
    .filter((c) => c.workplace_id === workplaceId)
    .map((c) => c.position)
  const maxPos = positions.length ? Math.max(...positions) : -1
  const cat = {
    id: body.id,
    workplace_id: workplaceId,
    title: body.title,
    position: maxPos + 1,
    is_active: true,
  }
  tx(() => db.menu_categories.push(cat))
  return categoryWithItems(cat)
}

export async function updateCategory(categoryId, patch) {
  await delay()
  const me = ensureMe()
  const c = find(db.menu_categories, categoryId)
  if (!c || !hasAccess(c.workplace_id, me.id)) throw notFound('Категория')
  const allowed = ['title', 'is_active']
  tx(() => {
    for (const k of allowed) if (patch[k] !== undefined) c[k] = patch[k]
  })
  return categoryWithItems(c)
}

export async function deleteCategory(categoryId) {
  await delay()
  const me = ensureMe()
  const c = find(db.menu_categories, categoryId)
  if (!c || !hasAccess(c.workplace_id, me.id)) throw notFound('Категория')
  tx(() => {
    const itemIds = db.menu_items.filter((i) => i.category_id === categoryId).map((i) => i.id)
    db.menu_items = db.menu_items.filter((i) => i.category_id !== categoryId)
    for (const oi of db.order_items) {
      if (itemIds.includes(oi.menu_item_id)) oi.menu_item_id = null
    }
    db.menu_categories = db.menu_categories.filter((x) => x.id !== categoryId)
  })
}

export async function reorderCategories(workplaceId, ids) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  tx(() => {
    let pos = 0
    for (const id of ids) {
      const c = find(db.menu_categories, id)
      if (c && c.workplace_id === workplaceId) c.position = pos++
    }
  })
}

export async function createItem(categoryId, body) {
  await delay()
  const me = ensureMe()
  const c = find(db.menu_categories, categoryId)
  if (!c || !hasAccess(c.workplace_id, me.id)) throw notFound('Категория')
  if (find(db.menu_items, body.id)) throw conflict('Item id already exists')
  const positions = db.menu_items
    .filter((i) => i.category_id === categoryId)
    .map((i) => i.position)
  const maxPos = positions.length ? Math.max(...positions) : -1
  const item = {
    id: body.id,
    category_id: categoryId,
    title: body.title,
    description: body.description ?? null,
    portion: body.portion ?? null,
    price: body.price,
    position: maxPos + 1,
    is_active: true,
  }
  tx(() => db.menu_items.push(item))
  return clone(item)
}

export async function updateItem(itemId, patch) {
  await delay()
  const me = ensureMe()
  const item = find(db.menu_items, itemId)
  if (!item) throw notFound('Позиция меню')
  const cat = find(db.menu_categories, item.category_id)
  if (!cat || !hasAccess(cat.workplace_id, me.id)) throw notFound('Позиция меню')

  const result = tx(() => {
    if (patch.category_id !== undefined && patch.category_id !== item.category_id) {
      const newCat = find(db.menu_categories, patch.category_id)
      if (!newCat || !hasAccess(newCat.workplace_id, me.id)) {
        throw badRequest('target category not found or access denied')
      }
      if (newCat.workplace_id !== cat.workplace_id) {
        throw badRequest('cross-workplace move not allowed')
      }
      const positions = db.menu_items
        .filter((i) => i.category_id === patch.category_id)
        .map((i) => i.position)
      const maxPos = positions.length ? Math.max(...positions) : -1
      item.category_id = patch.category_id
      item.position = maxPos + 1
    }
    const allowed = ['title', 'description', 'portion', 'price', 'is_active']
    for (const k of allowed) if (patch[k] !== undefined) item[k] = patch[k]
    return item
  })
  return clone(result)
}

export async function deleteItem(itemId) {
  await delay()
  const me = ensureMe()
  const item = find(db.menu_items, itemId)
  if (!item) throw notFound('Позиция меню')
  const cat = find(db.menu_categories, item.category_id)
  if (!cat || !hasAccess(cat.workplace_id, me.id)) throw notFound('Позиция меню')
  tx(() => {
    for (const oi of db.order_items) {
      if (oi.menu_item_id === itemId) oi.menu_item_id = null
    }
    db.menu_items = db.menu_items.filter((x) => x.id !== itemId)
  })
}

export async function reorderItems(categoryId, ids) {
  await delay()
  const me = ensureMe()
  const c = find(db.menu_categories, categoryId)
  if (!c || !hasAccess(c.workplace_id, me.id)) throw notFound('Категория')
  tx(() => {
    let pos = 0
    for (const id of ids) {
      const i = find(db.menu_items, id)
      if (i && i.category_id === categoryId) i.position = pos++
    }
  })
}

// =====================
// Shifts
// =====================

function recomputeShiftAggregates(shift) {
  const paidOrders = db.orders.filter((o) => o.shift_id === shift.id && o.is_paid)
  shift.order_count = paidOrders.length
  shift.total_cash_register = round2(paidOrders.reduce((s, o) => s + o.total_price, 0))
  shift.total_tips = round2(paidOrders.reduce((s, o) => s + o.tips, 0))
  if (shift.shift_type === 'percent') {
    shift.total_pay_for_shift = round2(
      shift.total_cash_register * (shift.service_percent / 100),
    )
  } else {
    shift.total_pay_for_shift = shift.pay_for_shift
  }
}

export async function getCurrentShift(workplaceId) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  const shift = db.shifts.find(
    (s) => s.workplace_id === workplaceId && s.opened_by_user_id === me.id && !s.is_closed,
  )
  return shift ? clone(shift) : null
}

export async function openShift(workplaceId, body) {
  await delay()
  const me = ensureMe()
  const wp = find(db.workplaces, workplaceId)
  if (!wp || !hasAccess(workplaceId, me.id)) throw notFound('Заведение')

  const existing = db.shifts.find(
    (s) => s.workplace_id === workplaceId && s.opened_by_user_id === me.id && !s.is_closed,
  )
  if (existing) throw conflict('У вас уже есть открытая смена в этом заведении')
  if (find(db.shifts, body.id)) throw conflict('Shift id already exists')

  const now = utcTs()
  const shift = {
    id: body.id,
    workplace_id: workplaceId,
    opened_by_user_id: me.id,
    start_time: now,
    is_closed: false,
    end_time: null,
    place_work_title: wp.title,
    currency: wp.currency,
    service_percent: wp.service_percent_default,
    shift_type: wp.shift_type_default,
    pay_for_shift: wp.pay_for_shift_default,
    total_pay_for_shift: wp.pay_for_shift_default,
    total_tips: 0,
    total_cash_register: 0,
    order_count: 0,
    duration: 0,
  }
  tx(() => {
    db.shifts.push(shift)
    db.me.last_workplace_id = workplaceId
  })
  return clone(shift)
}

export async function listShifts(workplaceId, opts = {}) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  const { limit = 50, offset = 0, onlyMine = true, closedOnly = true } = opts
  let list = db.shifts.filter((s) => s.workplace_id === workplaceId)
  if (onlyMine) list = list.filter((s) => s.opened_by_user_id === me.id)
  if (closedOnly) list = list.filter((s) => s.is_closed)
  list.sort((a, b) => b.start_time - a.start_time)
  return list.slice(offset, offset + limit).map(clone)
}

export async function getShift(shiftId) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  return clone(s)
}

export async function closeShift(shiftId, { force = false } = {}) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  if (s.opened_by_user_id !== me.id) throw forbidden('only opener can close')
  if (s.is_closed) throw conflict('Смена уже закрыта')

  const unpaidCount = db.orders.filter((o) => o.shift_id === s.id && !o.is_paid).length
  if (unpaidCount && !force) {
    throw conflict(`У смены ${unpaidCount} неоплаченных заказов; передайте force=true`)
  }
  const result = tx(() => {
    recomputeShiftAggregates(s)
    const unpaidIds = db.orders
      .filter((o) => o.shift_id === s.id && !o.is_paid)
      .map((o) => o.id)
    for (const t of db.tables) {
      if (t.order_id && unpaidIds.includes(t.order_id)) {
        t.order_id = null
        t.status = 'free'
      }
    }
    const now = utcTs()
    s.end_time = now
    s.is_closed = true
    s.duration = Math.max(0, now - s.start_time)
    return s
  })
  return clone(result)
}

export async function recomputeShift(shiftId) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  if (s.opened_by_user_id !== me.id) throw forbidden('only opener')
  tx(() => recomputeShiftAggregates(s))
  return clone(s)
}

export async function deleteShift(shiftId) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  if (s.opened_by_user_id !== me.id) throw forbidden('only opener')
  if (!s.is_closed) throw conflict('Нельзя удалить открытую смену; сначала закройте её')
  tx(() => {
    const orderIds = db.orders.filter((o) => o.shift_id === shiftId).map((o) => o.id)
    db.order_items = db.order_items.filter((oi) => !orderIds.includes(oi.order_id))
    db.orders = db.orders.filter((o) => o.shift_id !== shiftId)
    db.shifts = db.shifts.filter((x) => x.id !== shiftId)
  })
}

// =====================
// Orders
// =====================

function itemsOfOrder(orderId) {
  return db.order_items.filter((oi) => oi.order_id === orderId).map(clone)
}

function orderWithItems(o) {
  const cloned = clone(o)
  cloned.items = itemsOfOrder(o.id)
  return cloned
}

function recomputeOrderTotal(orderId) {
  const items = db.order_items.filter((oi) => oi.order_id === orderId)
  const o = find(db.orders, orderId)
  if (o) o.total_price = round2(items.reduce((s, x) => s + x.total_price, 0))
}

function attachOrderToTable(orderId, tableId) {
  const t = find(db.tables, tableId)
  if (t) {
    t.order_id = orderId
    t.status = 'waiting'
  }
}

function recomputeTableStatusForOrder(orderId) {
  const o = find(db.orders, orderId)
  if (!o || !o.table_id) return
  const t = find(db.tables, o.table_id)
  if (!t || t.order_id !== o.id) return
  const items = itemsOfOrder(o.id)
  if (items.length === 0) {
    t.status = 'waiting'
    return
  }
  const allServed = items.every((i) => i.served)
  t.status = allServed ? 'occupied' : 'waiting'
}

function detachOrderFromTable(order) {
  if (!order.table_id) return
  const t = find(db.tables, order.table_id)
  if (t && t.order_id === order.id) {
    t.order_id = null
    t.status = 'free'
  }
}

function ensureEditable(o) {
  if (o.is_paid) throw conflict('Нельзя изменить оплаченный заказ')
}

function buildOrder({ orderId, shift, tableId, items, comments, guestsCount }) {
  if (shift.is_closed) throw conflict('Нельзя создать заказ в закрытой смене')
  if (find(db.orders, orderId)) throw conflict('Order id already exists')

  let tableSnap = { table_id: null, hall_id: null, table_number: null, hall_name: null }
  if (tableId) {
    const t = find(db.tables, tableId)
    if (!t) throw notFound('Стол')
    if (t.order_id) throw conflict('У стола уже есть активный заказ')
    const h = find(db.halls, t.hall_id)
    if (!h) throw notFound('Зал')
    if (h.workplace_id !== shift.workplace_id) throw badRequest('Стол из другого заведения')
    tableSnap = {
      table_id: t.id,
      hall_id: h.id,
      table_number: t.number,
      hall_name: h.name,
    }
  }

  const now = utcTs()
  const order = {
    id: orderId,
    shift_id: shift.id,
    ...tableSnap,
    comments: comments ?? null,
    guests_count: guestsCount ?? 1,
    created_at: now,
    updated_at: now,
    closed_at: null,
    tips: 0,
    total_price: 0,
    is_paid: false,
    is_done: false,
  }
  db.orders.push(order)

  for (const raw of items) {
    db.order_items.push({
      id: raw.id,
      order_id: order.id,
      menu_item_id: raw.menu_item_id ?? null,
      title: raw.title,
      price: raw.price,
      quantity: raw.quantity,
      total_price: round2(raw.price * raw.quantity),
      comment: raw.comment ?? null,
      guest: raw.guest ?? 1,
      served: false,
    })
  }
  recomputeOrderTotal(order.id)

  if (tableId) attachOrderToTable(order.id, tableId)
  return order
}

export async function createOrderInShift(shiftId, body) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  if (s.opened_by_user_id !== me.id) {
    throw forbidden('Только владелец смены может создавать в ней заказы')
  }
  const order = tx(() =>
    buildOrder({
      orderId: body.id,
      shift: s,
      tableId: body.table_id,
      items: body.items || [],
      comments: body.comments,
      guestsCount: body.guests_count,
    }),
  )
  return orderWithItems(order)
}

export async function createOrderInCurrentShift(workplaceId, body) {
  await delay()
  const me = ensureMe()
  if (!hasAccess(workplaceId, me.id)) throw notFound('Заведение')
  const shift = db.shifts.find(
    (s) => s.workplace_id === workplaceId && s.opened_by_user_id === me.id && !s.is_closed,
  )
  if (!shift) throw conflict('Нет открытой смены — сначала откройте смену')
  const order = tx(() =>
    buildOrder({
      orderId: body.id,
      shift,
      tableId: body.table_id,
      items: body.items || [],
      comments: body.comments,
      guestsCount: body.guests_count,
    }),
  )
  return orderWithItems(order)
}

export async function listOrdersForShift(shiftId, { onlyActive = false, onlyPaid = false } = {}) {
  await delay()
  const me = ensureMe()
  const s = find(db.shifts, shiftId)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Смена')
  let list = db.orders.filter((o) => o.shift_id === shiftId)
  if (onlyActive) list = list.filter((o) => !o.is_paid)
  if (onlyPaid) list = list.filter((o) => o.is_paid)
  list.sort((a, b) => b.created_at - a.created_at)
  return list.map(orderWithItems)
}

export async function getOrder(orderId) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')
  return orderWithItems(o)
}

export async function updateOrder(orderId, patch) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')
  ensureEditable(o)
  tx(() => {
    if (patch.comments !== undefined) o.comments = patch.comments
    if (patch.is_done !== undefined) o.is_done = patch.is_done
    o.updated_at = utcTs()
  })
  return orderWithItems(o)
}

export async function deleteOrder(orderId) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')

  tx(() => {
    const wasPaid = o.is_paid
    detachOrderFromTable(o)
    db.order_items = db.order_items.filter((oi) => oi.order_id !== orderId)
    db.orders = db.orders.filter((x) => x.id !== orderId)
    if (wasPaid) recomputeShiftAggregates(s)
  })
}

export async function addOrderItems(orderId, items) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')
  ensureEditable(o)

  tx(() => {
    for (const raw of items) {
      if (find(db.order_items, raw.id)) {
        throw conflict(`Order item id ${raw.id} already exists`)
      }
      db.order_items.push({
        id: raw.id,
        order_id: o.id,
        menu_item_id: raw.menu_item_id ?? null,
        title: raw.title,
        price: raw.price,
        quantity: raw.quantity,
        total_price: round2(raw.price * raw.quantity),
        comment: raw.comment ?? null,
        guest: raw.guest ?? 1,
        served: false,
      })
    }
    recomputeOrderTotal(o.id)
    o.updated_at = utcTs()
    recomputeTableStatusForOrder(o.id)
  })
  return orderWithItems(o)
}

export async function updateOrderItem(itemId, patch) {
  await delay()
  const me = ensureMe()
  const oi = find(db.order_items, itemId)
  if (!oi) throw notFound('Позиция заказа')
  const o = find(db.orders, oi.order_id)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Позиция заказа')

  const touchesMoney =
    patch.title !== undefined ||
    patch.price !== undefined ||
    patch.quantity !== undefined ||
    patch.comment !== undefined
  if (touchesMoney) ensureEditable(o)

  tx(() => {
    if (patch.title !== undefined) oi.title = patch.title
    if (patch.price !== undefined) oi.price = patch.price
    if (patch.quantity !== undefined) oi.quantity = patch.quantity
    if (patch.comment !== undefined) oi.comment = patch.comment
    if (patch.served !== undefined) oi.served = !!patch.served
    oi.total_price = round2(oi.price * oi.quantity)
    recomputeOrderTotal(o.id)
    o.updated_at = utcTs()
    recomputeTableStatusForOrder(o.id)
  })
  return orderWithItems(o)
}

export async function removeOrderItem(itemId) {
  await delay()
  const me = ensureMe()
  const oi = find(db.order_items, itemId)
  if (!oi) throw notFound('Позиция заказа')
  const o = find(db.orders, oi.order_id)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Позиция заказа')
  ensureEditable(o)

  tx(() => {
    db.order_items = db.order_items.filter((x) => x.id !== itemId)
    recomputeOrderTotal(o.id)
    o.updated_at = utcTs()
    recomputeTableStatusForOrder(o.id)
  })
  return orderWithItems(o)
}

export async function moveOrder(orderId, newTableId) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')
  ensureEditable(o)
  if (newTableId === o.table_id) return orderWithItems(o)

  tx(() => {
    detachOrderFromTable(o)
    if (newTableId == null) {
      o.table_id = null
      o.hall_id = null
      o.table_number = null
      o.hall_name = null
    } else {
      const t = find(db.tables, newTableId)
      if (!t) throw notFound('Целевой стол')
      if (t.order_id) throw conflict('У целевого стола уже есть заказ')
      const h = find(db.halls, t.hall_id)
      if (!h) throw notFound('Зал')
      if (h.workplace_id !== s.workplace_id) throw badRequest('Стол из другого заведения')
      o.table_id = t.id
      o.hall_id = h.id
      o.table_number = t.number
      o.hall_name = h.name
      attachOrderToTable(o.id, t.id)
      recomputeTableStatusForOrder(o.id)
    }
    o.updated_at = utcTs()
  })
  return orderWithItems(o)
}

export async function payOrder(orderId, { tips = 0 } = {}) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')
  if (o.is_paid) throw conflict('Заказ уже оплачен')
  if (itemsOfOrder(o.id).length === 0) throw badRequest('Нельзя оплатить пустой заказ')

  tx(() => {
    o.tips = tips
    o.is_paid = true
    o.is_done = true
    o.closed_at = utcTs()
    o.updated_at = o.closed_at
    detachOrderFromTable(o)
    recomputeShiftAggregates(s)
  })
  return orderWithItems(o)
}

export async function editPaidOrder(orderId, patch) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')

  if (!o.is_paid) throw conflict('Заказ ещё не оплачен')
  if (s.is_closed) throw conflict('Смена закрыта — заказ нельзя редактировать')
  if (s.opened_by_user_id !== me.id) {
    throw forbidden('Только владелец смены может редактировать заказы')
  }

  tx(() => {
    if (Array.isArray(patch.items)) {
      db.order_items = db.order_items.filter((oi) => oi.order_id !== o.id)
      for (const raw of patch.items) {
        const qty = Math.max(1, Number(raw.quantity) || 1)
        const price = Number(raw.price) || 0
        db.order_items.push({
          id: raw.id || newId(),
          order_id: o.id,
          menu_item_id: raw.menu_item_id ?? null,
          title: raw.title || 'Без названия',
          price,
          quantity: qty,
          total_price: round2(price * qty),
          comment: raw.comment ?? null,
          guest: raw.guest ?? 1,
          served: false,
        })
      }
      recomputeOrderTotal(o.id)
    }
    if (patch.guests_count !== undefined) {
      o.guests_count = Math.max(1, Math.min(10, Number(patch.guests_count) || 1))
    }
    if (patch.tips !== undefined) o.tips = Number(patch.tips) || 0
    if (patch.comments !== undefined) o.comments = patch.comments
    o.updated_at = utcTs()
    recomputeShiftAggregates(s)
  })
  return orderWithItems(o)
}

export async function reopenOrder(orderId) {
  await delay()
  const me = ensureMe()
  const o = find(db.orders, orderId)
  if (!o) throw notFound('Заказ')
  const s = find(db.shifts, o.shift_id)
  if (!s || !hasAccess(s.workplace_id, me.id)) throw notFound('Заказ')

  if (!o.is_paid) throw conflict('Заказ ещё не оплачен')
  if (s.is_closed) throw conflict('Смена закрыта — заказ нельзя вернуть в активные')
  if (s.opened_by_user_id !== me.id) {
    throw forbidden('Только владелец смены может возвращать заказы')
  }

  if (o.table_id) {
    const t = find(db.tables, o.table_id)
    if (t && t.order_id && t.order_id !== o.id) {
      throw conflict('Стол уже занят другим заказом')
    }
  }

  tx(() => {
    o.is_paid = false
    o.is_done = false
    o.closed_at = 0
    o.tips = 0
    o.updated_at = utcTs()
    if (o.table_id) {
      attachOrderToTable(o.id, o.table_id)
      recomputeTableStatusForOrder(o.id)
    }
    recomputeShiftAggregates(s)
  })
  return orderWithItems(o)
}

// =====================
// Notes
// =====================

export async function listNotes(opts = {}) {
  await delay()
  const me = ensureMe()
  const {
    scope, workplaceId, shiftId,
    includeArchived = false, pinnedOnly = false,
    limit = 100, offset = 0,
  } = opts
  let list = db.notes.filter((n) => n.user_id === me.id)
  if (scope) list = list.filter((n) => n.scope === scope)
  if (workplaceId) list = list.filter((n) => n.workplace_id === workplaceId)
  if (shiftId) list = list.filter((n) => n.shift_id === shiftId)
  if (!includeArchived) list = list.filter((n) => !n.is_archived)
  if (pinnedOnly) list = list.filter((n) => n.pinned)
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updated_at - a.updated_at
  })
  return list.slice(offset, offset + limit).map(clone)
}

export async function createNote(body) {
  await delay()
  const me = ensureMe()
  if (find(db.notes, body.id)) throw conflict('Note id already exists')

  const { scope, workplace_id, shift_id } = body
  if (scope === 'global' && (workplace_id || shift_id)) {
    throw badRequest('global notes must not have workplace_id/shift_id')
  }
  if (scope === 'workplace' && (!workplace_id || shift_id)) {
    throw badRequest('workplace notes require workplace_id and no shift_id')
  }
  if (scope === 'shift' && !shift_id) {
    throw badRequest('shift notes require shift_id')
  }
  if (workplace_id && !hasAccess(workplace_id, me.id)) throw badRequest('workplace not accessible')
  if (shift_id) {
    const s = find(db.shifts, shift_id)
    if (!s || !hasAccess(s.workplace_id, me.id)) throw badRequest('shift not accessible')
  }

  const now = utcTs()
  const note = {
    id: body.id,
    user_id: me.id,
    scope,
    workplace_id: workplace_id ?? null,
    shift_id: shift_id ?? null,
    header: body.header,
    content: body.content ?? null,
    pinned: body.pinned ?? false,
    is_archived: false,
    created_at: now,
    updated_at: now,
  }
  tx(() => db.notes.push(note))
  return clone(note)
}

export async function getNote(id) {
  await delay()
  const me = ensureMe()
  const n = find(db.notes, id)
  if (!n || n.user_id !== me.id) throw notFound('Заметка')
  return clone(n)
}

export async function updateNote(id, patch) {
  await delay()
  const me = ensureMe()
  const n = find(db.notes, id)
  if (!n || n.user_id !== me.id) throw notFound('Заметка')
  const allowed = ['header', 'content', 'pinned', 'is_archived']
  tx(() => {
    for (const k of allowed) if (patch[k] !== undefined) n[k] = patch[k]
    n.updated_at = utcTs()
  })
  return clone(n)
}

export async function deleteNote(id) {
  await delay()
  const me = ensureMe()
  const n = find(db.notes, id)
  if (!n || n.user_id !== me.id) throw notFound('Заметка')
  tx(() => {
    db.notes = db.notes.filter((x) => x.id !== id)
  })
}
WN_TOOLS_EOF

# ---- src/api/reminders.js ----
cat > "src/api/reminders.js" <<'WN_TOOLS_EOF'
import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/reminders'

/**
 * Reminders API. Mirrors the notes API shape. Reminders are personal to
 * the user and stored on the server (synced across devices). The Telegram
 * bot notifies the user `lead_minutes` before `remind_at` — that part is
 * the backend/bot's job; the frontend only manages the data.
 *
 * Reminder shape:
 *   { id, user_id, text, remind_at (unix sec), lead_minutes, is_done,
 *     created_at, updated_at }
 */
export const remindersApi = {
  list(opts = {}) {
    if (USE_MOCK) return mock.listReminders(opts)
    const { includeDone = true, limit = 500, offset = 0 } = opts
    return apiGet('/reminders', {
      params: { include_done: includeDone, limit, offset },
    })
  },
  create(body) {
    return USE_MOCK ? mock.createReminder(body) : apiPost('/reminders', body)
  },
  update(id, patch) {
    return USE_MOCK ? mock.updateReminder(id, patch) : apiPatch(`/reminders/${id}`, patch)
  },
  remove(id) {
    return USE_MOCK ? mock.deleteReminder(id) : apiDelete(`/reminders/${id}`)
  },
}
WN_TOOLS_EOF

# ---- src/stores/reminders.js ----
cat > "src/stores/reminders.js" <<'WN_TOOLS_EOF'
import { create } from 'zustand'
import { remindersApi } from '@/api/reminders'

/**
 * "Remind me before" presets (minutes before remind_at). Single choice
 * per reminder. The bot fires the notification at remind_at - lead.
 */
export const LEAD_OPTIONS = [
  { value: 0, label: 'В момент' },
  { value: 5, label: 'За 5 минут' },
  { value: 15, label: 'За 15 минут' },
  { value: 30, label: 'За 30 минут' },
  { value: 60, label: 'За 1 час' },
  { value: 120, label: 'За 2 часа' },
  { value: 1440, label: 'За 1 день' },
]

export function leadLabel(value) {
  return LEAD_OPTIONS.find((o) => o.value === value)?.label ?? `За ${value} мин`
}

/**
 * Reminders store. Personal to the user; kept fully in memory (a user has
 * tens, not thousands). Mirrors the notes store conventions: optimistic
 * update() with rollback, selectors derived in components via useMemo.
 */
export const useRemindersStore = create((set, get) => ({
  items: [],
  isLoading: false,
  loaded: false,
  error: null,

  sorted: () => [...get().items].sort((a, b) => a.remind_at - b.remind_at),

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await remindersApi.list({ includeDone: true, limit: 500 })
      set({ items, loaded: true })
    } catch (e) {
      set({ error: e.message })
      throw e
    } finally {
      set({ isLoading: false })
    }
  },

  create: async (body) => {
    const r = await remindersApi.create(body)
    set({ items: [...get().items, r] })
    return r
  },

  update: async (id, patch) => {
    const items = get().items
    const idx = items.findIndex((r) => r.id === id)
    if (idx < 0) return
    const prev = items[idx]
    set({ items: items.map((r, i) => (i === idx ? { ...prev, ...patch } : r)) })
    try {
      const updated = await remindersApi.update(id, patch)
      set({ items: get().items.map((r) => (r.id === id ? updated : r)) })
    } catch (e) {
      set({ items: get().items.map((r) => (r.id === id ? prev : r)) })
      throw e
    }
  },

  toggleDone: async (id) => {
    const r = get().items.find((x) => x.id === id)
    if (!r) return
    return get().update(id, { is_done: !r.is_done })
  },

  remove: async (id) => {
    const prev = get().items
    set({ items: prev.filter((r) => r.id !== id) })
    try {
      await remindersApi.remove(id)
    } catch (e) {
      set({ items: prev })
      throw e
    }
  },

  reset: () => set({ items: [], loaded: false, error: null }),
}))
WN_TOOLS_EOF

# ---- src/mocks/reminders.js ----
cat > "src/mocks/reminders.js" <<'WN_TOOLS_EOF'
import { ApiError } from '@/api/client'

/**
 * Standalone mock for reminders (used when VITE_USE_MOCK=true). Kept
 * separate from the main mock db so the feature is self-contained and
 * persists to its own localStorage key. The real app talks to the server
 * via api/reminders.js instead.
 */

const KEY = 'wn-reminders-mock'
const ts = () => Math.floor(Date.now() / 1000)
const clone = (o) => JSON.parse(JSON.stringify(o))

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* storage unavailable */
  }
}

let store = load()
if (!store) {
  const now = ts()
  store = [
    { id: 'demo-r1', text: 'Заказать молоко для бара', remind_at: now + 2 * 3600, lead_minutes: 30, is_done: false, created_at: now, updated_at: now },
    { id: 'demo-r2', text: 'Позвонить поставщику кофе', remind_at: now + 26 * 3600, lead_minutes: 60, is_done: false, created_at: now, updated_at: now },
    { id: 'demo-r3', text: 'Сдать отчёт по смене', remind_at: now - 3 * 3600, lead_minutes: 0, is_done: false, created_at: now, updated_at: now },
  ]
  save()
}

export async function listReminders() {
  return store.slice().sort((a, b) => a.remind_at - b.remind_at).map(clone)
}

export async function createReminder(body) {
  if (!body.text || !body.text.trim()) throw new ApiError('Введите текст напоминания', { status: 400 })
  if (typeof body.remind_at !== 'number') throw new ApiError('Не указано время', { status: 400 })
  const now = ts()
  const r = {
    id: body.id,
    text: body.text.trim(),
    remind_at: body.remind_at,
    lead_minutes: body.lead_minutes ?? 0,
    is_done: false,
    created_at: now,
    updated_at: now,
  }
  store = [...store, r]
  save()
  return clone(r)
}

export async function updateReminder(id, patch) {
  const i = store.findIndex((r) => r.id === id)
  if (i < 0) throw new ApiError('Напоминание не найдено', { status: 404 })
  const allowed = ['text', 'remind_at', 'lead_minutes', 'is_done']
  const upd = { ...store[i] }
  for (const k of allowed) if (patch[k] !== undefined) upd[k] = patch[k]
  upd.updated_at = ts()
  store = store.map((r, idx) => (idx === i ? upd : r))
  save()
  return clone(upd)
}

export async function deleteReminder(id) {
  store = store.filter((r) => r.id !== id)
  save()
}
WN_TOOLS_EOF

echo "Готово. Файлы обновлены. Перезапусти dev-сервер при необходимости."
