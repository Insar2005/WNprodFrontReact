import { apiGet, apiPost, apiPatch, apiDelete, USE_MOCK } from './client'
import * as mock from '@/mocks/handlers'

export const menuApi = {
  getTree(workplaceId, { activeOnly = false } = {}) {
    return USE_MOCK
      ? mock.getMenuTree(workplaceId, { activeOnly })
      : apiGet(`/workplaces/${workplaceId}/menu`, { params: { active_only: activeOnly } })
  },

  createCategory(workplaceId, body) {
    return USE_MOCK
      ? mock.createCategory(workplaceId, body)
      : apiPost(`/workplaces/${workplaceId}/menu/categories`, body)
  },
  updateCategory(categoryId, patch) {
    return USE_MOCK
      ? mock.updateCategory(categoryId, patch)
      : apiPatch(`/menu/categories/${categoryId}`, patch)
  },
  removeCategory(categoryId) {
    return USE_MOCK
      ? mock.deleteCategory(categoryId)
      : apiDelete(`/menu/categories/${categoryId}`)
  },
  reorderCategories(workplaceId, ids) {
    return USE_MOCK
      ? mock.reorderCategories(workplaceId, ids)
      : apiPost(`/workplaces/${workplaceId}/menu/categories/reorder`, { ids })
  },

  createItem(categoryId, body) {
    return USE_MOCK
      ? mock.createItem(categoryId, body)
      : apiPost(`/menu/categories/${categoryId}/items`, body)
  },
  updateItem(itemId, patch) {
    return USE_MOCK
      ? mock.updateItem(itemId, patch)
      : apiPatch(`/menu/items/${itemId}`, patch)
  },
  removeItem(itemId) {
    return USE_MOCK ? mock.deleteItem(itemId) : apiDelete(`/menu/items/${itemId}`)
  },
  reorderItems(categoryId, ids) {
    return USE_MOCK
      ? mock.reorderItems(categoryId, ids)
      : apiPost(`/menu/categories/${categoryId}/items/reorder`, { ids })
  },
}