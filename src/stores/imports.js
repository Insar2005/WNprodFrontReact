import { create } from 'zustand'
import { importsApi } from '@/api/imports'

/**
 * Two sides of the same feature share one store:
 *   - Owner side: list/create/revoke shares for the current workplace
 *   - Importer side: preview a code, apply a copy into the user's workplace
 *
 * State is intentionally narrow — we don't cache previews aggressively
 * because the source workplace can change between visits (the owner might
 * add a hall right before sharing). Each "open" of the import screen
 * refetches.
 */
export const useImportsStore = create((set, get) => ({
  // ----- Owner side -----
  shares: [],
  isLoadingShares: false,

  // ----- Importer side -----
  preview: null, // { source_workplace_title, halls, categories }
  previewCode: null, // currently previewed code (for retries)
  isLoadingPreview: false,

  // === getters (were: computed) ===

  activeShares: () => get().shares.filter((s) => s.is_active),

  // === actions: owner side ===

  fetchShares: async (workplaceId) => {
    set({ isLoadingShares: true })
    try {
      const shares = await importsApi.listShares(workplaceId)
      set({ shares })
    } finally {
      set({ isLoadingShares: false })
    }
  },

  createShare: async (workplaceId, { ttl_hours = 24 } = {}) => {
    const share = await importsApi.createShare(workplaceId, { ttl_hours })
    // Prepend so the freshly-created one shows on top.
    set({ shares: [share, ...get().shares] })
    return share
  },

  revokeShare: async (shareId) => {
    await importsApi.revokeShare(shareId)
    // Reflect locally — backend has marked revoked_at; recompute is_active.
    set({
      shares: get().shares.map((s) =>
        s.id === shareId
          ? {
              ...s,
              is_active: false,
              revoked_at: Math.floor(Date.now() / 1000),
            }
          : s,
      ),
    })
  },

  // === actions: importer side ===

  fetchPreview: async (code) => {
    set({ isLoadingPreview: true, previewCode: code })
    try {
      const preview = await importsApi.preview(code)
      set({ preview })
    } catch (e) {
      set({ preview: null })
      throw e
    } finally {
      set({ isLoadingPreview: false })
    }
  },

  clearPreview: () => {
    set({ preview: null, previewCode: null })
  },

  applyImport: async ({
    code,
    target_workplace_id,
    hall_ids = [],
    category_ids = [],
    replace_halls = false,
    replace_categories = false,
  }) => {
    return importsApi.apply(code, {
      target_workplace_id,
      hall_ids,
      category_ids,
      replace_halls,
      replace_categories,
    })
  },

  reset: () => {
    set({
      shares: [],
      preview: null,
      previewCode: null,
      isLoadingShares: false,
      isLoadingPreview: false,
    })
  },
}))