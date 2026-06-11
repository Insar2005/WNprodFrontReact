/**
 * In-app diagnostics log buffer.
 *
 * Captures network attempts, errors and environment info so a user on a
 * device we can't reach (e.g. a different region) can show us what is
 * actually happening. Kept entirely in memory — no persistence.
 *
 * MIGRATION NOTE: framework-agnostic, carried over verbatim from the Vue
 * project. The DiagnosticsPanel component (ported in step 4) subscribes
 * via onDiagChange().
 */

const MAX_ENTRIES = 100
const entries = []
const listeners = new Set()

function notify() {
  for (const fn of listeners) {
    try {
      fn(entries.slice())
    } catch {
      /* ignore listener errors */
    }
  }
}

/**
 * Add a diagnostic entry.
 * @param {'info'|'error'|'net'} level
 * @param {string} message
 * @param {object} [extra] - small serialisable detail object
 */
export function logDiag(level, message, extra) {
  const entry = {
    t: new Date().toISOString(),
    level,
    message: String(message),
    extra: extra ? safeStringify(extra) : null,
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()
  notify()
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj)
  } catch {
    return String(obj)
  }
}

/** Current log snapshot (newest last). */
export function getDiagLog() {
  return entries.slice()
}

/** Clear the buffer. */
export function clearDiagLog() {
  entries.length = 0
  notify()
}

/** Subscribe to log changes. Returns an unsubscribe function. */
export function onDiagChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** One-off snapshot of the environment, useful at the top of a report. */
export function envSnapshot() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null
  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '(not set)',
    useMock: import.meta.env.VITE_USE_MOCK || '(not set)',
    online: typeof navigator !== 'undefined' ? navigator.onLine : 'n/a',
    platform: tg?.platform || 'n/a',
    tgVersion: tg?.version || 'n/a',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
  }
}

/**
 * Actively probe whether the backend is reachable from this device.
 * Returns a result object; also writes to the diag log.
 */
export async function probeBackend() {
  const base = import.meta.env.VITE_API_BASE_URL || ''
  if (!base) {
    logDiag('error', 'probe: VITE_API_BASE_URL is empty')
    return { ok: false, reason: 'no-base-url' }
  }
  const url = base.replace(/\/$/, '') + '/docs'
  const started = Date.now()
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors' })
    const ms = Date.now() - started
    logDiag('net', `probe: backend reachable (${ms}ms)`, { url })
    return { ok: true, ms }
  } catch (e) {
    const ms = Date.now() - started
    logDiag('error', `probe: backend NOT reachable (${ms}ms)`, {
      url,
      error: e?.message || String(e),
    })
    return { ok: false, reason: 'fetch-failed', error: e?.message }
  }
}