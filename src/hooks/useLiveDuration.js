import { useEffect, useState } from 'react'

/**
 * Live-updating elapsed seconds since a start timestamp (unix seconds).
 * React replacement for the Vue useLiveDuration composable.
 *
 * @param {() => number | null} getStart - function returning the start
 *   unix-seconds (a getter so the caller can pass props.shift?.start_time
 *   without it going stale). Re-reads each tick.
 * @param {number} interval - ms between ticks (default 1000 for a live clock).
 * @returns {number} elapsed whole seconds (>= 0)
 */
export function useLiveDuration(getStart, interval = 1000) {
  const compute = () => {
    const start = getStart()
    if (!start) return 0
    return Math.max(0, Math.floor(Date.now() / 1000) - Number(start))
  }
  const [seconds, setSeconds] = useState(compute)
  useEffect(() => {
    const id = setInterval(() => setSeconds(compute), interval)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval])
  return seconds
}