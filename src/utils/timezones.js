/**
 * Curated list of timezones for the workplace settings.
 * MIGRATION NOTE: framework-agnostic, carried over verbatim.
 */
export const TIMEZONES = [
  { id: 'Europe/Lisbon',         offsetMin: 0,    cities: 'Лиссабон' },
  { id: 'Europe/London',         offsetMin: 0,    cities: 'Лондон' },
  { id: 'Europe/Berlin',         offsetMin: 60,   cities: 'Берлин, Париж' },
  { id: 'Europe/Kaliningrad',    offsetMin: 120,  cities: 'Калининград' },
  { id: 'Europe/Kiev',           offsetMin: 120,  cities: 'Киев' },
  { id: 'Europe/Moscow',         offsetMin: 180,  cities: 'Москва, Минск' },
  { id: 'Europe/Istanbul',       offsetMin: 180,  cities: 'Стамбул' },
  { id: 'Asia/Tbilisi',          offsetMin: 240,  cities: 'Тбилиси, Ереван' },
  { id: 'Europe/Samara',         offsetMin: 240,  cities: 'Самара' },
  { id: 'Asia/Yekaterinburg',    offsetMin: 300,  cities: 'Екатеринбург' },
  { id: 'Asia/Tashkent',         offsetMin: 300,  cities: 'Ташкент' },
  { id: 'Asia/Almaty',           offsetMin: 300,  cities: 'Алматы, Астана' },
  { id: 'Asia/Bishkek',          offsetMin: 360,  cities: 'Бишкек' },
  { id: 'Asia/Omsk',             offsetMin: 360,  cities: 'Омск' },
  { id: 'Asia/Novosibirsk',      offsetMin: 420,  cities: 'Новосибирск' },
  { id: 'Asia/Krasnoyarsk',      offsetMin: 420,  cities: 'Красноярск' },
  { id: 'Asia/Irkutsk',          offsetMin: 480,  cities: 'Иркутск' },
  { id: 'Asia/Yakutsk',          offsetMin: 540,  cities: 'Якутск' },
  { id: 'Asia/Vladivostok',      offsetMin: 600,  cities: 'Владивосток' },
  { id: 'Asia/Magadan',          offsetMin: 660,  cities: 'Магадан' },
  { id: 'Asia/Kamchatka',        offsetMin: 720,  cities: 'Камчатка' },
]

/** Format an offset in minutes as "UTC+3" / "UTC-5:30" / "UTC". */
export function formatUtcOffset(offsetMin) {
  if (offsetMin === 0) return 'UTC'
  const sign = offsetMin > 0 ? '+' : '−'
  const abs = Math.abs(offsetMin)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  if (mins === 0) return `UTC${sign}${hours}`
  return `UTC${sign}${hours}:${String(mins).padStart(2, '0')}`
}

/** "UTC+3 — Москва, Минск" */
export function formatTimezoneOption(tz) {
  return `${formatUtcOffset(tz.offsetMin)} — ${tz.cities}`
}

/** Find the entry matching an IANA id, or null. */
export function findTimezone(id) {
  return TIMEZONES.find((t) => t.id === id) || null
}