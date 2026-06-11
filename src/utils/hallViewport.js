/**
 * Persistent viewport state for hall maps.
 *
 * Each hall remembers its last zoom level and pan offset so returning
 * to the map doesn't slam the user back to the centered default. Stored
 * in localStorage under a single key — a small map { hallId → state }.
 *
 * The hall id is the localStorage cell's grain, not a separate key, so
 * we read/write the whole map and keep churn cheap (one key, one write).
 *
 * Quietly degrades to no-op if localStorage isn't available (Safari
 * private mode, etc) — the caller should always have a sensible default.
 *
 * MIGRATION NOTE: framework-agnostic, carried over verbatim.
 */

const STORAGE_KEY = 'wn:hall_viewports'

/** Internal: read the whole map. Returns {} on any error. */
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Internal: write the whole map. Silent on failure. */
function writeAll(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota exceeded or storage disabled — just skip persistence.
  }
}

/**
 * Read the saved viewport for a hall, if any.
 * Returns { scale, panX, panY } or null when nothing was saved.
 */
export function loadHallViewport(hallId) {
  if (!hallId) return null
  const map = readAll()
  const entry = map[hallId]
  if (!entry || typeof entry !== 'object') return null
  const { scale, panX, panY } = entry
  if (
    typeof scale !== 'number' ||
    typeof panX !== 'number' ||
    typeof panY !== 'number'
  ) {
    return null
  }
  return { scale, panX, panY }
}

/** Persist the viewport for a hall. Coordinates are rounded to keep the
 *  stored value compact and to avoid noisy writes from sub-pixel pans. */
export function saveHallViewport(hallId, { scale, panX, panY }) {
  if (!hallId) return
  const map = readAll()
  map[hallId] = {
    scale: Math.round(scale * 100) / 100,
    panX: Math.round(panX),
    panY: Math.round(panY),
  }
  writeAll(map)
}

/** Forget the viewport for a hall — useful when the hall is deleted
 *  so we don't accumulate stale entries forever. */
export function clearHallViewport(hallId) {
  if (!hallId) return
  const map = readAll()
  if (hallId in map) {
    delete map[hallId]
    writeAll(map)
  }
}