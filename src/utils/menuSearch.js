/**
 * Menu search — prefix-per-word matching.
 *
 * The user's query is split into terms; each term must be a prefix of
 * SOME WORD in the searchable text. This is what you'd expect from a
 * restaurant menu search:
 *
 *   query "га" → matches "Гамбургер" (starts word #1)
 *              → matches "Гарнир из риса" (starts word #1)
 *              → does NOT match "манГАле" (mid-word)
 *              → does NOT match "грибы на манГАле"
 *
 *   query "ман" → matches "грибы на Мангале" (starts word #3)
 *              → matches "Манты" (starts word #1)
 *              → does NOT match "гаммандл" (no such thing but you get it)
 *
 *   query "куриц" → matches "Куриное филе" (prefix of word #1)
 *   query "кури суп" → matches "Куриный суп" (both terms have prefix hits)
 *                    → does NOT match "Суп с курицей" — "кури" is a prefix
 *                       of "курицей", "суп" of "суп", so this DOES match too.
 *                       Multi-term is treated as AND, order-independent.
 *
 * Case- and diacritic-insensitive within Cyrillic/Latin — we simply
 * lowercase both sides. Real diacritic-normalization (NFKD stripping)
 * isn't worth the complexity for the languages this menu targets.
 *
 * Word boundaries: whitespace, hyphens, and common punctuation. We use a
 * regex split rather than \b because \b is unreliable across Cyrillic in
 * older JS engines.
 */

const WORD_SPLIT_RE = /[\s\-_/(),.;:«»"'!?]+/

/**
 * Return true if `text` matches the search `query` under the prefix-
 * per-word rule described above. Falsy text or empty query → false.
 */
export function matchesMenuQuery(text, query) {
  if (!text || !query) return false
  const q = query.trim().toLowerCase()
  if (!q) return false

  const words = text.toLowerCase().split(WORD_SPLIT_RE).filter(Boolean)
  if (words.length === 0) return false

  // Query may be multiple terms — every term must hit at least one word.
  // Splitting the query the same way as the text keeps behaviour symmetric
  // (a user typing "куриц суп" with the same delimiters we accept in
  // titles will always work).
  const terms = q.split(WORD_SPLIT_RE).filter(Boolean)
  if (terms.length === 0) return false

  for (const term of terms) {
    let hit = false
    for (const word of words) {
      if (word.startsWith(term)) {
        hit = true
        break
      }
    }
    if (!hit) return false
  }
  return true
}

/**
 * Convenience: try several text fields on the same item (e.g. title +
 * description + portion), returning true if ANY of them satisfies the
 * per-word prefix rule for the whole query.
 *
 * The pattern is: query terms must all hit — but they don't need to hit
 * in the SAME field. "куриц 300" matches "Куриное филе" (title) + "300 г"
 * (portion). This is closer to what people actually expect from a
 * search box that spans multiple fields.
 */
export function matchesMenuQueryAcross(fields, query) {
  if (!query) return false
  const q = query.trim().toLowerCase()
  if (!q) return false

  const terms = q.split(WORD_SPLIT_RE).filter(Boolean)
  if (terms.length === 0) return false

  // Collect ALL words from ALL fields into one big pool.
  const words = []
  for (const f of fields) {
    if (!f) continue
    for (const w of String(f).toLowerCase().split(WORD_SPLIT_RE)) {
      if (w) words.push(w)
    }
  }
  if (words.length === 0) return false

  for (const term of terms) {
    let hit = false
    for (const word of words) {
      if (word.startsWith(term)) {
        hit = true
        break
      }
    }
    if (!hit) return false
  }
  return true
}