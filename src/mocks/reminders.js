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
