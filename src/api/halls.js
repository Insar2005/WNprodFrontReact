import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const hallsApi = {
  listForWorkplace(workplaceId) {
    return USE_MOCK ? mock.listHalls(workplaceId) : apiGet(`/workplaces/${workplaceId}/halls`)
  },
  create(workplaceId, body) {
    return USE_MOCK
      ? mock.createHall(workplaceId, body)
      : apiPost(`/workplaces/${workplaceId}/halls`, body)
  },
  reorder(workplaceId, ids) {
    return USE_MOCK
      ? mock.reorderHalls(workplaceId, ids)
      : apiPost(`/workplaces/${workplaceId}/halls/reorder`, { ids })
  },
  get(hallId) {
    return USE_MOCK ? mock.getHall(hallId) : apiGet(`/halls/${hallId}`)
  },
  update(hallId, patch) {
    return USE_MOCK ? mock.updateHall(hallId, patch) : apiPatch(`/halls/${hallId}`, patch)
  },
  remove(hallId) {
    return USE_MOCK ? mock.deleteHall(hallId) : apiDelete(`/halls/${hallId}`)
  },
}

export const tablesApi = {
  create(hallId, body) {
    return USE_MOCK ? mock.createTable(hallId, body) : apiPost(`/halls/${hallId}/tables`, body)
  },
  update(tableId, patch) {
    return USE_MOCK ? mock.updateTable(tableId, patch) : apiPatch(`/tables/${tableId}`, patch)
  },
  remove(tableId) {
    return USE_MOCK ? mock.deleteTable(tableId) : apiDelete(`/tables/${tableId}`)
  },
}

/**
 * Hall layouts ("templates") — saved table arrangements within a hall.
 * Endpoints mirror the planned REST contract on the backend so swapping
 * USE_MOCK = false later requires no code changes here.
 */
export const layoutsApi = {
  listForHall(hallId) {
    return USE_MOCK
      ? mock.listLayouts(hallId)
      : apiGet(`/halls/${hallId}/layouts`)
  },
  create(hallId, body) {
    return USE_MOCK
      ? mock.createLayout(hallId, body)
      : apiPost(`/halls/${hallId}/layouts`, body)
  },
  update(layoutId, patch) {
    return USE_MOCK
      ? mock.updateLayout(layoutId, patch)
      : apiPatch(`/layouts/${layoutId}`, patch)
  },
  remove(layoutId) {
    return USE_MOCK
      ? mock.deleteLayout(layoutId)
      : apiDelete(`/layouts/${layoutId}`)
  },
  apply(layoutId, body = {}) {
    return USE_MOCK
      ? mock.applyLayout(layoutId, body)
      : apiPost(`/layouts/${layoutId}/apply`, body)
  },
}