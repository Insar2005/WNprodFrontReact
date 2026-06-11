import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const ordersApi = {
  listForShift(shiftId, { onlyActive = false, onlyPaid = false } = {}) {
    return USE_MOCK
      ? mock.listOrdersForShift(shiftId, { onlyActive, onlyPaid })
      : apiGet(`/shifts/${shiftId}/orders`, {
          params: { only_active: onlyActive, only_paid: onlyPaid },
        })
  },
  createInShift(shiftId, body) {
    return USE_MOCK
      ? mock.createOrderInShift(shiftId, body)
      : apiPost(`/shifts/${shiftId}/orders`, body)
  },
  createInCurrentShift(workplaceId, body) {
    return USE_MOCK
      ? mock.createOrderInCurrentShift(workplaceId, body)
      : apiPost(`/workplaces/${workplaceId}/orders`, body)
  },
  get(orderId) {
    return USE_MOCK ? mock.getOrder(orderId) : apiGet(`/orders/${orderId}`)
  },
  update(orderId, patch) {
    return USE_MOCK ? mock.updateOrder(orderId, patch) : apiPatch(`/orders/${orderId}`, patch)
  },
  remove(orderId) {
    return USE_MOCK ? mock.deleteOrder(orderId) : apiDelete(`/orders/${orderId}`)
  },
  addItems(orderId, items) {
    return USE_MOCK
      ? mock.addOrderItems(orderId, items)
      : apiPost(`/orders/${orderId}/items`, { items })
  },
  updateItem(itemId, patch) {
    return USE_MOCK
      ? mock.updateOrderItem(itemId, patch)
      : apiPatch(`/orders/order-items/${itemId}`, patch)
  },
  removeItem(itemId) {
    return USE_MOCK
      ? mock.removeOrderItem(itemId)
      : apiDelete(`/orders/order-items/${itemId}`)
  },
  move(orderId, tableId) {
    return USE_MOCK
      ? mock.moveOrder(orderId, tableId)
      : apiPost(`/orders/${orderId}/move`, { table_id: tableId })
  },
  pay(orderId, { tips = 0 } = {}) {
    return USE_MOCK
      ? mock.payOrder(orderId, { tips })
      : apiPost(`/orders/${orderId}/pay`, { tips })
  },
  reopen(orderId) {
    return USE_MOCK
      ? mock.reopenOrder(orderId)
      : apiPost(`/orders/${orderId}/reopen`, {})
  },
  editPaid(orderId, patch) {
    return USE_MOCK
      ? mock.editPaidOrder(orderId, patch)
      : apiPatch(`/orders/${orderId}/edit`, patch)
  },
}