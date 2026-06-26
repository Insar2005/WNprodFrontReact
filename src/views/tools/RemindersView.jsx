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
