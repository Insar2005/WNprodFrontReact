import { useEffect, useMemo, useRef, useState } from 'react'
import {
  clearDiagLog,
  envSnapshot,
  getDiagLog,
  onDiagChange,
  probeBackend,
} from '@/utils/diagnostics'

/**
 * Diagnostics bottom-sheet. Shows the in-memory log buffer + environment
 * snapshot + quick actions (probe backend, copy log to clipboard, clear).
 *
 * Mount is gated by App.jsx on `ui.diagnosticsOpen` — this component just
 * paints the sheet and calls `onClose` when the user closes it.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Log list is external state (module buffer in utils/diagnostics.js) —
 *   we subscribe via onDiagChange in a useEffect. Initial sync inside the
 *   effect uses the scoped set-state-in-effect disable that other stores
 *   in this project use for external-source syncs.
 * - envSnapshot() is a one-off read, so useMemo([]).
 * - "Скопировано" flash → useState + setTimeout with cleanup ref.
 * - Clipboard: navigator.clipboard first; fallback to a hidden textarea
 *   + execCommand for older Telegram WebViews where the async API is
 *   gated behind a user gesture that pointerdown-inside-sheet may miss.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function DiagnosticsPanel({ onClose }) {
  const [entries, setEntries] = useState(() => getDiagLog())
  const [probing, setProbing] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef(0)

  const env = useMemo(() => envSnapshot(), [])

  useEffect(() => {
    // External source: entries may have been logged between the useState
    // initializer and this effect committing. Sync once, then subscribe.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(getDiagLog())
    return onDiagChange(setEntries)
  }, [])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const onProbe = async () => {
    if (probing) return
    setProbing(true)
    try {
      await probeBackend()
    } finally {
      setProbing(false)
    }
  }

  const onCopy = async () => {
    const report = buildReport(env, entries)
    const ok = await copyToClipboard(report)
    if (!ok) return
    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500)
  }

  const onClear = () => {
    clearDiagLog()
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="diag-overlay" onClick={onOverlayClick}>
      <div className="diag-panel" role="dialog" aria-modal="true">
        <header className="diag-header">
          <span className="diag-title">Диагностика</span>
          <button
            className="diag-x"
            type="button"
            onClick={() => onClose?.()}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="diag-actions">
          <button
            className="diag-btn"
            type="button"
            disabled={probing}
            onClick={onProbe}
          >
            {probing ? 'Проверяю…' : 'Проверить бэкенд'}
          </button>
          <button
            className="diag-btn diag-btn--ghost"
            type="button"
            onClick={onCopy}
          >
            Скопировать
          </button>
          <button
            className="diag-btn diag-btn--ghost"
            type="button"
            onClick={onClear}
          >
            Очистить
          </button>
        </div>

        {copied && <div className="diag-copied">Скопировано</div>}

        <div className="diag-env">
          {Object.entries(env).map(([k, v]) => (
            <div className="diag-env-row" key={k}>
              <span className="diag-env-k">{k}</span>
              <span className="diag-env-v">{String(v)}</span>
            </div>
          ))}
        </div>

        <div className="diag-log">
          {entries.length === 0 ? (
            <div className="diag-empty">Записей пока нет</div>
          ) : (
            entries.map((e, i) => (
              <div key={i} className={`diag-line diag-line--${e.level}`}>
                <span className="diag-time">{formatTime(e.t)}</span>
                {e.message}
                {e.extra && <span className="diag-extra">{e.extra}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback below for older Telegram WebViews where the async API is
    // gated or unavailable.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.setAttribute('readonly', '')
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function formatTime(iso) {
  try {
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } catch {
    return iso
  }
}

function buildReport(env, entries) {
  const lines = []
  lines.push('=== Waiter Note diagnostics ===')
  lines.push('')
  lines.push('-- env --')
  for (const [k, v] of Object.entries(env)) lines.push(`${k}: ${v}`)
  lines.push('')
  lines.push(`-- log (${entries.length}) --`)
  for (const e of entries) {
    lines.push(`[${e.t}] ${e.level.toUpperCase()} ${e.message}`)
    if (e.extra) lines.push(`  ${e.extra}`)
  }
  return lines.join('\n')
}