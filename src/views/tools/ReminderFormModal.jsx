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
