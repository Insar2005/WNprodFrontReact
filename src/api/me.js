import { apiGet, apiPatch, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const meApi = {
  get() {
    return USE_MOCK ? mock.getMe() : apiGet('/me')
  },
  update(patch) {
    return USE_MOCK ? mock.updateMe(patch) : apiPatch('/me', patch)
  },
  // Probe whether our bot can write to the user. In mock mode we always
  // grant access — the gate is for the real backend / real Telegram only.
  getBotAccess() {
    return USE_MOCK
      ? Promise.resolve({ status: 'ok', bot_username: 'waiternote_bot' })
      : apiGet('/me/bot-access')
  },
}