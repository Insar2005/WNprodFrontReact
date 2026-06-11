import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const notesApi = {
  list(opts = {}) {
    if (USE_MOCK) return mock.listNotes(opts)
    const {
      scope, workplaceId, shiftId,
      includeArchived = false, pinnedOnly = false,
      limit = 100, offset = 0,
    } = opts
    return apiGet('/notes', {
      params: {
        scope,
        workplace_id: workplaceId,
        shift_id: shiftId,
        include_archived: includeArchived,
        pinned_only: pinnedOnly,
        limit,
        offset,
      },
    })
  },
  create(body) {
    return USE_MOCK ? mock.createNote(body) : apiPost('/notes', body)
  },
  get(id) {
    return USE_MOCK ? mock.getNote(id) : apiGet(`/notes/${id}`)
  },
  update(id, patch) {
    return USE_MOCK ? mock.updateNote(id, patch) : apiPatch(`/notes/${id}`, patch)
  },
  remove(id) {
    return USE_MOCK ? mock.deleteNote(id) : apiDelete(`/notes/${id}`)
  },
}