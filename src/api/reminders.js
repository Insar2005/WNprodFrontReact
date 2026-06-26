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
