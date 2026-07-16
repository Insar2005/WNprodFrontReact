/**
 * Форматтеры дат/длительностей смен — общие для вкладки «Смены»,
 * отчёта по смене и истории заказов. TZ Europe/Moscow, как в utils/format.
 */
export const SHIFT_TZ = 'Europe/Moscow'

export const MONTHS_UP = [
  'ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ',
  'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ',
]

/** {year, month(0-11)} метки времени в TZ смен. */
export function dateParts(unixSec) {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: SHIFT_TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(new Date(unixSec * 1000))
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  return { year: get('year'), month: get('month') - 1 }
}

/** «12 июля, сб» */
export function dayLabel(unixSec) {
  const d = new Date(unixSec * 1000)
  const dm = new Intl.DateTimeFormat('ru-RU', {
    timeZone: SHIFT_TZ, day: 'numeric', month: 'long',
  }).format(d)
  const wd = new Intl.DateTimeFormat('ru-RU', { timeZone: SHIFT_TZ, weekday: 'short' }).format(d)
  return `${dm}, ${wd}`
}

/** «12 июля» (заголовок отчёта). */
export function dayShort(unixSec) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: SHIFT_TZ, day: 'numeric', month: 'long',
  }).format(new Date(unixSec * 1000))
}

/** «5 ч 45 м» / «45 м» */
export function fmtDur(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h} ч ${m} м` : `${m} м`
}

/** «5:42:18» — живой таймер. */
export function fmtTimer(sec) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Час (0-23) метки в TZ смен — бакеты гистограммы. */
export function hourOf(unixSec) {
  return Number(
    new Intl.DateTimeFormat('ru-RU', {
      timeZone: SHIFT_TZ, hour: 'numeric', hour12: false,
    }).format(new Date(unixSec * 1000)),
  )
}
