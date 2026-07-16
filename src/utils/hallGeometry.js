/**
 * Геометрия залов и столов — общие хелперы Карты и Редактора карты.
 * Вынесены из HallEditorCanvas.jsx: файлы компонентов должны экспортировать
 * только компоненты (react-refresh/only-export-components), иначе HMR
 * перезагружает страницу целиком.
 */

/** Шаг снап-сетки редактора, в единицах зала. */
export const ED_SNAP = 8

/** Видимый bbox стола с произвольным поворотом вокруг центра. */
export function visBox(t) {
  const r = ((t.rotation || 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  const bw = t.width * c + t.height * s
  const bh = t.width * s + t.height * c
  return { x: t.x + (t.width - bw) / 2, y: t.y + (t.height - bh) / 2, w: bw, h: bh }
}

/** BBox всех столов зала + паддинг 20 — для «вписать зал» на Карте. */
export function tablesBBox(tables) {
  let x0 = 1e9
  let y0 = 1e9
  let x1 = -1e9
  let y1 = -1e9
  for (const t of tables) {
    const v = visBox(t)
    x0 = Math.min(x0, v.x)
    y0 = Math.min(y0, v.y)
    x1 = Math.max(x1, v.x + v.w)
    y1 = Math.max(y1, v.y + v.h)
  }
  if (x0 > x1) return { x: 0, y: 0, w: 100, h: 100 }
  return { x: x0 - 20, y: y0 - 20, w: x1 - x0 + 40, h: y1 - y0 + 40 }
}

/** Возвращает стол, сдвинутый так, чтобы его видимый bbox был в зале. */
export function edClamp(t, hall) {
  const v = visBox(t)
  let dx = 0
  let dy = 0
  if (v.x < 0) dx = -v.x
  else if (v.x + v.w > hall.width) dx = hall.width - v.x - v.w
  if (v.y < 0) dy = -v.y
  else if (v.y + v.h > hall.height) dy = hall.height - v.y - v.h
  return { ...t, x: Math.round(t.x + dx), y: Math.round(t.y + dy) }
}