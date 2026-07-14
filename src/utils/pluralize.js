/**
 * Russian plural selector.
 *
 * Was defined inline in OrderBuilderView and MenuEditorView; extracted to
 * a shared util (July 2026) because the menu tree components (SubCell's
 * nodeMeta, category meta lines) need it too.
 *
 * Usage:
 *   pluralize(n, ['позиция', 'позиции', 'позиций'])
 *   → forms[0] for 1, [1] for 2–4, [2] for 0/5+/teens.
 *
 * Rules (standard Russian):
 *   • 11–14 → many   (11 позиций)
 *   • last digit 1 → one   (21 позиция)
 *   • last digit 2–4 → few (23 позиции)
 *   • otherwise → many (25 позиций)
 *
 * @param {number} n
 * @param {[string, string, string]} forms - [one, few, many]
 * @returns {string}
 */
export function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}