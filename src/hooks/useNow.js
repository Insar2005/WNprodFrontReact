import { useEffect, useState } from 'react'

/**
 * Ticking "current time" hook — React replacement for @vueuse/core's useNow.
 *
 * Returns a Date that updates every `interval` ms. Used by lists that show
 * live durations (e.g. "⏱ 12м" on active orders) without each row owning a
 * timer. One interval drives every consumer of the same component instance.
 *
 * @param {number} interval ms between ticks (default 30s — fine for minute
 *   granularity; avoid 1000 on long lists, it's wasteful).
 */
export function useNow(interval = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}