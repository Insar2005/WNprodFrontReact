/**
 * "Top of shift" — per-shift click counter for menu items, persisted in
 * localStorage. Powers the search dropdown that shows the user's most
 * frequently picked dishes during the current shift.
 *
 * Key shape: `wn:menu-search-top:<shift_id>`. One key per shift so the
 * counter resets cleanly when a new shift opens (no stale data leaks).
 * Value is a plain JSON map: { [itemId]: clickCount }.
 *
 * Lives in utils/ (not co-located with the component) because:
 *   • OrderBuilderView ALSO calls bumpTopForItem on search-result clicks,
 *     not just through the dropdown — sharing this from a component file
 *     would trip react-refresh/only-export-components.
 *   • Tests/scripts can import the helpers without dragging in JSX.
 */

const STORAGE_PREFIX = 'wn:menu-search-top:'

/**
 * Build the localStorage key for a given shift. shiftId may be null —
 * we still want the dropdown to work outside of a shift (defensive), so
 * we key it under "no-shift" instead of throwing.
 */
function storageKey(shiftId) {
  return `${STORAGE_PREFIX}${shiftId ?? 'no-shift'}`
}

/**
 * Read the current top map for a shift. Returns { itemId: clickCount }.
 * Resilient to corrupt JSON — wipes the bad key and returns {}.
 */
export function readTopMap(shiftId) {
  try {
    const raw = localStorage.getItem(storageKey(shiftId))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    try { localStorage.removeItem(storageKey(shiftId)) } catch { /* ignore */ }
    return {}
  }
}

/**
 * Bump a click count for an item under the current shift. Called by
 * OrderBuilder whenever the user picks a menu item from search results
 * or from the top-of-shift dropdown itself.
 *
 * Best-effort: any storage failure (quota, disabled, sandboxed) is
 * silently swallowed — the user shouldn't see a toast because their
 * "popular items" stat couldn't save.
 */
export function bumpTopForItem(shiftId, itemId) {
  if (!itemId) return
  const map = readTopMap(shiftId)
  map[itemId] = (map[itemId] || 0) + 1
  try {
    localStorage.setItem(storageKey(shiftId), JSON.stringify(map))
  } catch {
    // quota exceeded / storage disabled — top-of-shift is best-effort
  }
}

/**
 * Clear the top-of-shift map for a given shift. Called from the
 * dropdown's "Очистить" button. Doesn't touch other shifts' keys, so
 * historical data for closed shifts is preserved (until the user
 * explicitly clears those too, which the UI doesn't currently allow).
 */
export function clearTopForShift(shiftId) {
  try {
    localStorage.removeItem(storageKey(shiftId))
  } catch {
    // ignore
  }
}