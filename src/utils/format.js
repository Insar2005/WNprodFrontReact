/**
 * Formatting helpers (money, dates, durations).
 * MIGRATION NOTE: framework-agnostic, carried over verbatim.
 */

/** Format money. Currency is a 3-letter code from workplace settings. */
export function formatMoney(amount, currency = 'RUB', locale = 'ru-RU') {
  if (amount == null) return ''
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${Number(amount).toFixed(2)} ${currency}`
  }
}

/** Format unix timestamp (seconds) to a date+time string in user's tz. */
export function formatDateTime(unixSeconds, timezone = 'Europe/Moscow', locale = 'ru-RU') {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Just the date part. */
export function formatDate(unixSeconds, timezone = 'Europe/Moscow', locale = 'ru-RU') {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** Just the time part HH:mm. */
export function formatTime(unixSeconds, timezone = 'Europe/Moscow', locale = 'ru-RU') {
  if (!unixSeconds) return ''
  const date = new Date(unixSeconds * 1000)
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Format duration in seconds as 'Hh Mm' or 'Mm Ss'. */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0с'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${sec}с`
  return `${sec}с`
}