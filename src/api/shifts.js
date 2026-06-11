import { apiGet, apiPost, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const shiftsApi = {
  getCurrent(workplaceId) {
    return USE_MOCK
      ? mock.getCurrentShift(workplaceId)
      : apiGet(`/workplaces/${workplaceId}/shifts/current`)
  },
  open(workplaceId, body) {
    return USE_MOCK
      ? mock.openShift(workplaceId, body)
      : apiPost(`/workplaces/${workplaceId}/shifts`, body)
  },
  list(workplaceId, opts = {}) {
    if (USE_MOCK) return mock.listShifts(workplaceId, opts)
    const { limit = 50, offset = 0, onlyMine = true, closedOnly = true } = opts
    return apiGet(`/workplaces/${workplaceId}/shifts`, {
      params: { limit, offset, only_mine: onlyMine, closed_only: closedOnly },
    })
  },
  get(shiftId) {
    return USE_MOCK ? mock.getShift(shiftId) : apiGet(`/shifts/${shiftId}`)
  },
  close(shiftId, { force = false } = {}) {
    return USE_MOCK
      ? mock.closeShift(shiftId, { force })
      : apiPost(`/shifts/${shiftId}/close`, null, { params: { force } })
  },
  recompute(shiftId) {
    return USE_MOCK ? mock.recomputeShift(shiftId) : apiPost(`/shifts/${shiftId}/recompute`)
  },
  remove(shiftId) {
    return USE_MOCK ? mock.deleteShift(shiftId) : apiDelete(`/shifts/${shiftId}`)
  },
}