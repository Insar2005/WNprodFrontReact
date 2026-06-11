import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const workplacesApi = {
  list({ includeArchived = false } = {}) {
    return USE_MOCK
      ? mock.listWorkplaces({ includeArchived })
      : apiGet('/workplaces', { params: { include_archived: includeArchived } })
  },

  get(id) {
    return USE_MOCK ? mock.getWorkplace(id) : apiGet(`/workplaces/${id}`)
  },

  create(body) {
    return USE_MOCK ? mock.createWorkplace(body) : apiPost('/workplaces', body)
  },

  update(id, patch) {
    return USE_MOCK ? mock.updateWorkplace(id, patch) : apiPatch(`/workplaces/${id}`, patch)
  },

  archive(id) {
    return USE_MOCK ? mock.archiveWorkplace(id) : apiPost(`/workplaces/${id}/archive`)
  },

  unarchive(id) {
    return USE_MOCK ? mock.unarchiveWorkplace(id) : apiPost(`/workplaces/${id}/unarchive`)
  },

  remove(id) {
    return USE_MOCK ? mock.deleteWorkplace(id) : apiDelete(`/workplaces/${id}`)
  },

  reorder(ids) {
    return USE_MOCK ? mock.reorderWorkplaces(ids) : apiPost('/workplaces/reorder', { ids })
  },

  select(id) {
    return USE_MOCK ? mock.selectWorkplace(id) : apiPost(`/workplaces/${id}/select`)
  },
}