import { useEffect, useMemo, useRef, useState } from 'react'
import { readTopMap, clearTopForShift } from '@/utils/topOfShift'

const TOP_LIMIT = 5

/**
 * Search input with an optional "Top of shift" dropdown that opens on
 * focus when the input is empty. Once the user starts typing, the
 * parent (OrderBuilder) takes over and shows actual search results
 * in its own area — the dropdown closes.
 *
 * The dropdown shows up to 5 items ranked by click count for the
 * current shift. Each click on a found dish bumps the count via
 * bumpTopForItem (caller's job — called from OrderBuilder). Tapping a
 * top row is the same as picking it from search — caller's onPick
 * decides what that means (select category, add to cart, etc.).
 *
 * ── How the top map is read without setState-in-effect ──────────────
 * We derive `topMap` via useMemo over a `revision` counter rather than
 * a useEffect that pushes to state. The revision bumps when:
 *   • the input becomes focused → user might see updated counts that
 *     other parts of the app wrote since last open;
 *   • the shiftId changes → reading a different shift's key;
 *   • the user taps "Очистить" → we wipe storage and bump.
 * This avoids "setState synchronously within an effect" because the
 * read is just derive-from-prop (revision + shiftId), not a state push.
 * ─────────────────────────────────────────────────────────────────────
 *
 * Props:
 *   value         — current query (controlled)
 *   onChange      — (string) => void; query changed
 *   shiftId       — id of the current open shift, or null
 *   items         — all menu items array (for resolving top ids to data)
 *   categoryById  — { id: category } map for breadcrumb labels
 *   onPick        — (item) => void; user tapped a top row; parent
 *                   should select category, clear query, add to cart
 *   placeholder   — input placeholder text
 */
export default function SearchWithTopOfShift({
  value,
  onChange,
  shiftId,
  items,
  categoryById,
  onPick,
  placeholder = 'Поиск по меню…',
}) {
  const [focused, setFocused] = useState(false)
  // Revision counter — bumped whenever we want to force a re-read of
  // localStorage. Not pretty, but it sidesteps the setState-in-effect
  // anti-pattern: we never push storage contents INTO React state, we
  // just re-derive from storage on demand.
  const [revision, setRevision] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Derive the top rows directly from storage. Reading from localStorage
  // synchronously here is fine — it's a tiny string lookup, cheaper than
  // most useMemo bodies. We include `focused` in deps so the rows are
  // fresh every time the dropdown opens, and `revision` so a parent or
  // sibling write triggers a re-read when needed.
  //
  // Why derive instead of state: storage IS the source of truth. Mirroring
  // it into React state means there are now TWO sources of truth and we
  // need an effect to keep them in sync — exactly the case the
  // set-state-in-effect rule is warning about.
  const topRows = useMemo(() => {
    if (!focused) return []
    const map = readTopMap(shiftId)
    const entries = Object.entries(map)
    if (entries.length === 0) return []
    const sorted = entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_LIMIT)
    const rows = []
    for (const [itemId, count] of sorted) {
      const item = items.find((i) => i.id === itemId)
      if (!item) continue // item deleted — silently skip
      const cat = categoryById?.[item.category_id]
      rows.push({
        item,
        count,
        pathLabel: cat?.title ?? '—',
      })
    }
    return rows
    // revision intentionally in deps so a write/clear forces re-read.
  }, [focused, shiftId, items, categoryById, revision])

  // Dropdown only when input is focused, empty (no query yet), and we
  // have at least one row to show. Otherwise it's noise.
  const showDropdown = focused && !value && topRows.length > 0

  // Close dropdown when clicking outside. Pointer events cover both
  // mouse and touch. This is genuine external-system sync (DOM events),
  // and only setFocused is called from the listener — that's a
  // callback-driven state update, not setState-in-effect-body.
  useEffect(() => {
    if (!focused) return
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setFocused(false)
        // Blur the input too so the keyboard dismisses on mobile.
        inputRef.current?.blur()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [focused])

  const handlePickRow = (item) => {
    setFocused(false)
    inputRef.current?.blur()
    onPick?.(item)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    clearTopForShift(shiftId)
    // Bump revision so the useMemo above re-reads (now-empty) storage.
    setRevision((r) => r + 1)
  }

  return (
    <div className="search-wrap search-tof" ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          // Bumping revision on focus ensures fresh storage read for
          // the dropdown — between opens, another part of the app
          // (the click-on-search-result handler) may have bumped counts.
          setRevision((r) => r + 1)
          setFocused(true)
        }}
        // Hint to mobile keyboards: this is a text search, no autocorrect
        // chrome, no enter-key surprises.
        inputMode="search"
        enterKeyHint="search"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Очистить"
        >
          ×
        </button>
      )}

      {showDropdown && (
        <div className="search-tof-dropdown">
          <div className="search-tof-header">
            <span className="search-tof-label">Топ за смену</span>
            <button
              type="button"
              className="search-tof-clear"
              onClick={handleClear}
            >
              Очистить
            </button>
          </div>
          {topRows.map(({ item, count, pathLabel }) => (
            <div
              key={item.id}
              className="search-tof-row"
              onClick={() => handlePickRow(item)}
            >
              <div className="search-tof-row-main">
                <span className="search-tof-row-name">{item.title}</span>
                <span className="search-tof-row-sub">{pathLabel}</span>
              </div>
              <span className="search-tof-row-count">{count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}