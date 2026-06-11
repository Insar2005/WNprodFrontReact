/**
 * Mock database. Single source of truth for all mocked data.
 *
 * Structure mirrors the backend models. All collections are plain arrays;
 * relationships maintained via foreign-key strings.
 *
 * Persistence: serialised to localStorage on every mutation.
 * Set VITE_MOCK_PERSIST=false to disable.
 *
 * NOTE: framework-agnostic plain JS — identical to the Vue project's mock.
 * import.meta.env works the same under Vite regardless of React/Vue.
 */

const STORAGE_KEY = 'waiter-note-mock-db'
const PERSIST = import.meta.env.VITE_MOCK_PERSIST !== 'false'

function emptyState() {
  return {
    me: null,
    workplaces: [],
    workplace_members: [],
    halls: [],
    tables: [],
    hall_layouts: [],
    table_positions: [],
    menu_categories: [],
    menu_items: [],
    shifts: [],
    orders: [],
    order_items: [],
    notes: [],
  }
}

function load() {
  if (!PERSIST) return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return { ...emptyState(), ...parsed }
  } catch {
    return emptyState()
  }
}

function persist() {
  if (!PERSIST) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // QuotaExceeded etc. — silent fail, mock still works in memory
  }
}

export const db = load()

/** Mutate db inside this callback; persistence happens once after. */
export function tx(fn) {
  const result = fn(db)
  persist()
  return result
}

/** Reset everything. */
export function resetDb() {
  Object.assign(db, emptyState())
  persist()
}

/**
 * Ensure db.me exists. Reads tg_id/username from env on first call.
 * Mirrors get_current_user's "create on first request" semantic.
 */
export function ensureMe() {
  if (db.me) return db.me

  const tgId = Number(import.meta.env.VITE_MOCK_USER_ID || 1)
  const username = import.meta.env.VITE_MOCK_USERNAME || 'dev_user'
  const language = import.meta.env.VITE_MOCK_LANGUAGE || 'ru'
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

  const now = Math.floor(Date.now() / 1000)
  db.me = {
    id: tgId,
    tg_id: tgId,
    username,
    language,
    timezone: 'Europe/Moscow',
    last_online_at: now,
    last_workplace_id: null,
    is_onboarding_completed: demoMode,
    is_disabled: false,
    accent_key: 'green',
    theme: 'auto',
    created_at: now,
    updated_at: now,
  }
  persist()
  return db.me
}

// =====================
// Demo seed (dev only)
// =====================

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
export function genId() {
  let s = ''
  for (let i = 0; i < 21; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return s
}

/** Deep clone helper shared with handlers. */
export function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj))
}

/**
 * Populate the mock DB with a realistic demo: one workplace, one hall with
 * 5 tables in various states, a small menu, an open shift with a couple of
 * orders, a closed shift in history, and a few notes.
 */
export function seedDemo() {
  const me = ensureMe()
  const now = Math.floor(Date.now() / 1000)

  // Workplace
  const wpId = genId()
  const wp = {
    id: wpId,
    owner_id: me.id,
    title: 'Демо-кофейня',
    timezone: 'Europe/Moscow',
    currency: 'RUB',
    service_percent_default: 10,
    shift_type_default: 'percent',
    pay_for_shift_default: 0,
    position: db.workplaces.length,
    is_archived: false,
    created_at: now,
    updated_at: now,
  }
  db.workplaces.push(wp)
  db.workplace_members.push({
    id: genId(),
    workplace_id: wpId,
    user_id: me.id,
    role: 'owner',
    joined_at: now,
  })
  db.me.last_workplace_id = wpId

  // Hall
  const hallId = genId()
  db.halls.push({
    id: hallId,
    workplace_id: wpId,
    name: 'Основной зал',
    width: 1000,
    height: 1000,
    scale: 1.0,
    position: 0,
  })

  // Tables — mixed statuses
  const tableSpecs = [
    { number: 1, x: 60, y: 60, status: 'free' },
    { number: 2, x: 220, y: 60, status: 'occupied' },
    { number: 3, x: 380, y: 60, status: 'waiting' },
    { number: 4, x: 60, y: 240, status: 'reserved' },
    { number: 5, x: 220, y: 240, status: 'free' },
  ]
  const tableIds = {}
  for (const spec of tableSpecs) {
    const id = genId()
    tableIds[spec.number] = id
    db.tables.push({
      id,
      hall_id: hallId,
      order_id: null,
      number: spec.number,
      x: spec.x,
      y: spec.y,
      width: 110,
      height: 110,
      rotation: 0,
      border_radius: 16,
      status: spec.status,
    })
  }

  // Menu — two categories
  const drinksId = genId()
  const foodId = genId()
  db.menu_categories.push(
    { id: drinksId, workplace_id: wpId, title: 'Напитки', position: 0, is_active: true },
    { id: foodId, workplace_id: wpId, title: 'Еда', position: 1, is_active: true },
  )

  const drinks = [
    { title: 'Капучино', price: 220, portion: '250 мл' },
    { title: 'Латте', price: 250, portion: '300 мл' },
    { title: 'Эспрессо', price: 150, portion: '40 мл' },
    { title: 'Раф ванильный', price: 290, portion: '300 мл' },
  ]
  const food = [
    { title: 'Круассан', price: 180, portion: null },
    { title: 'Чизкейк', price: 320, portion: '120 г' },
    { title: 'Сэндвич с курицей', price: 380, portion: null },
  ]
  const menuItemIds = {}
  drinks.forEach((d, i) => {
    const id = genId()
    menuItemIds[d.title] = id
    db.menu_items.push({
      id,
      category_id: drinksId,
      title: d.title,
      description: null,
      portion: d.portion,
      price: d.price,
      position: i,
      is_active: true,
    })
  })
  food.forEach((f, i) => {
    const id = genId()
    menuItemIds[f.title] = id
    db.menu_items.push({
      id,
      category_id: foodId,
      title: f.title,
      description: null,
      portion: f.portion,
      price: f.price,
      position: i,
      is_active: true,
    })
  })

  // Open shift (started 1.5h ago)
  const shiftId = genId()
  const shiftStart = now - 5400
  db.shifts.push({
    id: shiftId,
    workplace_id: wpId,
    opened_by_user_id: me.id,
    start_time: shiftStart,
    is_closed: false,
    end_time: null,
    place_work_title: wp.title,
    currency: wp.currency,
    service_percent: wp.service_percent_default,
    shift_type: wp.shift_type_default,
    pay_for_shift: wp.pay_for_shift_default,
    total_pay_for_shift: 0,
    total_tips: 0,
    total_cash_register: 0,
    order_count: 0,
    duration: 0,
  })

  // Active order on table #2
  const order1Id = genId()
  db.orders.push({
    id: order1Id,
    shift_id: shiftId,
    hall_id: hallId,
    table_id: tableIds[2],
    table_number: 2,
    hall_name: 'Основной зал',
    comments: null,
    created_at: now - 1200,
    updated_at: now - 600,
    closed_at: null,
    tips: 0,
    total_price: 540,
    is_paid: false,
    is_done: false,
  })
  db.tables.find((t) => t.id === tableIds[2]).order_id = order1Id
  db.order_items.push(
    {
      id: genId(),
      order_id: order1Id,
      menu_item_id: menuItemIds['Капучино'],
      title: 'Капучино',
      price: 220,
      quantity: 1,
      total_price: 220,
      comment: null,
    },
    {
      id: genId(),
      order_id: order1Id,
      menu_item_id: menuItemIds['Чизкейк'],
      title: 'Чизкейк',
      price: 320,
      quantity: 1,
      total_price: 320,
      comment: null,
    },
  )

  // Empty order on table #3 (waiting)
  const order2Id = genId()
  db.orders.push({
    id: order2Id,
    shift_id: shiftId,
    hall_id: hallId,
    table_id: tableIds[3],
    table_number: 3,
    hall_name: 'Основной зал',
    comments: 'Просили без сахара',
    created_at: now - 240,
    updated_at: now - 240,
    closed_at: null,
    tips: 0,
    total_price: 0,
    is_paid: false,
    is_done: false,
  })
  db.tables.find((t) => t.id === tableIds[3]).order_id = order2Id

  // One closed shift in history (yesterday)
  const closedShiftId = genId()
  const yesterday = now - 86400
  db.shifts.push({
    id: closedShiftId,
    workplace_id: wpId,
    opened_by_user_id: me.id,
    start_time: yesterday - 3600 * 8,
    end_time: yesterday,
    is_closed: true,
    place_work_title: wp.title,
    currency: wp.currency,
    service_percent: wp.service_percent_default,
    shift_type: wp.shift_type_default,
    pay_for_shift: wp.pay_for_shift_default,
    total_pay_for_shift: 740,
    total_tips: 350,
    total_cash_register: 7400,
    order_count: 12,
    duration: 3600 * 8,
  })

  // A few notes
  db.notes.push(
    {
      id: genId(),
      user_id: me.id,
      scope: 'global',
      workplace_id: null,
      shift_id: null,
      header: 'Сменщик заберёт 5к в среду',
      content: null,
      pinned: true,
      is_archived: false,
      created_at: now - 86400 * 2,
      updated_at: now - 86400 * 2,
    },
    {
      id: genId(),
      user_id: me.id,
      scope: 'workplace',
      workplace_id: wpId,
      shift_id: null,
      header: 'Кофемашина: фильтр менять каждые 4 дня',
      content: 'Левая кнопка → "menu" → "service".',
      pinned: false,
      is_archived: false,
      created_at: now - 86400 * 5,
      updated_at: now - 86400 * 5,
    },
    {
      id: genId(),
      user_id: me.id,
      scope: 'shift',
      workplace_id: wpId,
      shift_id: shiftId,
      header: 'Стол 2 — VIP, попросили чек на компанию',
      content: null,
      pinned: false,
      is_archived: false,
      created_at: now - 1200,
      updated_at: now - 1200,
    },
  )

  persist()
  return wp
}