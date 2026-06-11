import { apiGet, apiPost, apiDelete, USE_MOCK } from './client'

/**
 * Owner-side: publish, list, revoke import-shares for a workplace.
 * Importer-side: preview a share, apply a copy into the user's own workplace.
 *
 * Mock mode intentionally returns rejected promises with a friendly hint —
 * the import flow only makes sense against the real backend (no shared
 * state across mock sessions), and silently mocking it would mislead.
 *
 * NOTE: unlike the other api/* modules, this one does NOT import
 * '@/mocks/handlers' — it produces its own rejection in mock mode, so no
 * mock stub names are needed for imports.
 */

function mockUnsupported(verb) {
  return Promise.reject(
    new Error(
      `Импорт меню/залов доступен только в обычном режиме (не в демо). ${verb}`,
    ),
  )
}

export const importsApi = {
  // ----- Owner side -----
  listShares(workplaceId) {
    return USE_MOCK
      ? mockUnsupported('Список ссылок не загружен.')
      : apiGet(`/workplaces/${workplaceId}/import-shares`)
  },
  createShare(workplaceId, { ttl_hours = 24 } = {}) {
    return USE_MOCK
      ? mockUnsupported('Ссылка не создана.')
      : apiPost(`/workplaces/${workplaceId}/import-shares`, { ttl_hours })
  },
  revokeShare(shareId) {
    return USE_MOCK
      ? mockUnsupported('Ссылка не отозвана.')
      : apiDelete(`/import-shares/${shareId}`)
  },

  // ----- Importer side -----
  preview(code) {
    return USE_MOCK
      ? mockUnsupported('Предпросмотр недоступен.')
      : apiGet(`/import/${code}/preview`)
  },
  apply(code, {
    target_workplace_id,
    hall_ids = [],
    category_ids = [],
    replace_halls = false,
    replace_categories = false,
  }) {
    return USE_MOCK
      ? mockUnsupported('Импорт не выполнен.')
      : apiPost(`/import/${code}/apply`, {
          target_workplace_id,
          hall_ids,
          category_ids,
          replace_halls,
          replace_categories,
        })
  },
}