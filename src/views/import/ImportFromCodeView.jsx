import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useImportsStore } from '@/stores/imports'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

function formatResult(r) {
  const parts = []
  if (r.halls_imported > 0)
    parts.push(`${r.halls_imported} ${pluralize(r.halls_imported, ['зал', 'зала', 'залов'])}`)
  if (r.tables_imported > 0)
    parts.push(`${r.tables_imported} ${pluralize(r.tables_imported, ['стол', 'стола', 'столов'])}`)
  if (r.layouts_imported > 0)
    parts.push(`${r.layouts_imported} ${pluralize(r.layouts_imported, ['шаблон', 'шаблона', 'шаблонов'])}`)
  if (r.categories_imported > 0)
    parts.push(`${r.categories_imported} ${pluralize(r.categories_imported, ['категория', 'категории', 'категорий'])}`)
  if (r.items_imported > 0)
    parts.push(`${r.items_imported} ${pluralize(r.items_imported, ['позиция', 'позиции', 'позиций'])}`)
  return parts.length > 0 ? `Скопировано: ${parts.join(', ')}` : 'Импорт выполнен'
}

/**
 * Import-from-code flow. (Was ImportFromCodeView.vue.)
 * Three states: enter code → preview+select → applying.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - selectedHalls/selectedCategories are Sets in useState; toggles build a
 *   NEW Set each time (immutable update) so React re-renders.
 * - route.query.code → useSearchParams.
 * - onMounted prefill/focus → useEffect (runs once).
 * - preview lives in the imports store; we read it via selector.
 * NOTE: import only works against the real backend (mock store/API reject).
 * ─────────────────────────────────────────────────────────────────────
 */
export default function ImportFromCodeView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const preview = useImportsStore((s) => s.preview)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')
  const currentId = useWorkplaceStore((s) => s.currentId)

  const [codeInput, setCodeInput] = useState(() => searchParams.get('code') || '')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [selectedHalls, setSelectedHalls] = useState(() => new Set())
  const [selectedCategories, setSelectedCategories] = useState(() => new Set())
  const codeRef = useRef(null)

  const normalisedCode = useMemo(
    () => codeInput.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    [codeInput],
  )
  const codeReady = normalisedCode.length >= 4

  // Focus the input on mount only when there's no prefilled code (the
  // prefill itself is done in the useState initializer above, so no
  // setState-in-effect here).
  useEffect(() => {
    if (!searchParams.get('code')) {
      requestAnimationFrame(() => codeRef.current?.focus?.())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allHallsSelected =
    !!preview?.halls.length && preview.halls.every((h) => selectedHalls.has(h.id))
  const allCategoriesSelected =
    !!preview?.categories.length &&
    preview.categories.every((c) => selectedCategories.has(c.id))
  const hasSelection = selectedHalls.size > 0 || selectedCategories.size > 0

  const applyLabel = useMemo(() => {
    const halls = selectedHalls.size
    const cats = selectedCategories.size
    const parts = []
    if (halls > 0) parts.push(`${halls} ${pluralize(halls, ['зал', 'зала', 'залов'])}`)
    if (cats > 0)
      parts.push(`${cats} ${pluralize(cats, ['категорию', 'категории', 'категорий'])}`)
    return parts.length === 0 ? 'Импортировать' : `Импортировать ${parts.join(' и ')}`
  }, [selectedHalls, selectedCategories])

  const onLoadPreview = async () => {
    if (!codeReady || loading) return
    setLoading(true)
    try {
      await useImportsStore.getState().fetchPreview(normalisedCode)
      const p = useImportsStore.getState().preview
      setSelectedHalls(new Set(p.halls.map((h) => h.id)))
      setSelectedCategories(new Set(p.categories.map((c) => c.id)))
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось загрузить превью')
    } finally {
      setLoading(false)
    }
  }

  const onResetPreview = () => {
    useImportsStore.getState().clearPreview()
    setSelectedHalls(new Set())
    setSelectedCategories(new Set())
    requestAnimationFrame(() => codeRef.current?.focus?.())
  }

  const toggleHall = (id) => {
    setSelectedHalls((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }
  const toggleAllHalls = () => {
    setSelectedHalls(
      allHallsSelected ? new Set() : new Set(preview.halls.map((h) => h.id)),
    )
  }
  const toggleAllCategories = () => {
    setSelectedCategories(
      allCategoriesSelected
        ? new Set()
        : new Set(preview.categories.map((c) => c.id)),
    )
  }

  const onApply = async () => {
    if (!hasSelection || applying) return
    const ui = useUiStore.getState()
    if (!currentId) {
      ui.toastError('Сначала выбери заведение, в которое импортировать')
      return
    }
    setApplying(true)
    try {
      const imports = useImportsStore.getState()
      const result = await imports.applyImport({
        code: imports.previewCode,
        target_workplace_id: currentId,
        hall_ids: Array.from(selectedHalls),
        category_ids: Array.from(selectedCategories),
      })
      await Promise.all([
        useHallStore.getState().fetchAll(currentId).catch(() => {}),
        useMenuStore.getState().fetchAll(currentId).catch(() => {}),
      ])
      ui.toastSuccess(formatResult(result))
      imports.clearPreview()
      navigate('/home', { replace: true })
    } catch (e) {
      ui.toastError(e.message || 'Не удалось импортировать')
    } finally {
      setApplying(false)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/home')
  }

  return (
    <div className="page im-page">
      <header className="sub-header">
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
        <h1 className="sub-title">Импорт меню и залов</h1>
      </header>

      {/* State 1: enter code */}
      {!preview && !applying && (
        <section className="im-section">
          <p className="im-hint">
            Введи код, которым с тобой поделились — посмотришь, какие залы и
            меню можно скопировать в твоё заведение.
          </p>
          <label className="field">
            <span className="field-label">Код</span>
            <input
              ref={codeRef}
              className="field-input im-code-input"
              type="text"
              placeholder="WN7K3MAB"
              maxLength={16}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLoadPreview()}
            />
          </label>
          <button
            className="btn btn--primary im-btn"
            disabled={!codeReady || loading}
            onClick={onLoadPreview}
          >
            {loading ? 'Загружаем…' : 'Посмотреть, что внутри'}
          </button>
        </section>
      )}

      {/* State 2: preview + selection */}
      {preview && !applying && (
        <>
          <section className="im-section">
            <p className="im-src-title">
              От: <strong>{preview.source_workplace_title}</strong>
            </p>
            <p className="im-hint">
              Отметь, что скопировать в{' '}
              <strong>{currentTitle || 'своё заведение'}</strong>. Существующие
              данные не пропадут — копии добавятся к ним.
            </p>
          </section>

          {preview.halls.length > 0 && (
            <section className="im-section">
              <div className="im-section-head">
                <h2 className="im-section-title">Залы</h2>
                <button className="link-btn" onClick={toggleAllHalls}>
                  {allHallsSelected ? 'Снять все' : 'Выбрать все'}
                </button>
              </div>
              {preview.halls.map((h) => (
                <label key={h.id} className="im-row">
                  <input
                    type="checkbox"
                    checked={selectedHalls.has(h.id)}
                    onChange={() => toggleHall(h.id)}
                  />
                  <span className="im-row-main">
                    <span className="im-row-title">{h.name}</span>
                    <span className="im-row-meta">
                      {h.tables_count}{' '}
                      {pluralize(h.tables_count, ['стол', 'стола', 'столов'])}
                      {h.layouts_count > 0 &&
                        ` · ${h.layouts_count} ${pluralize(h.layouts_count, ['шаблон', 'шаблона', 'шаблонов'])}`}
                    </span>
                  </span>
                </label>
              ))}
            </section>
          )}

          {preview.categories.length > 0 && (
            <section className="im-section">
              <div className="im-section-head">
                <h2 className="im-section-title">Меню</h2>
                <button className="link-btn" onClick={toggleAllCategories}>
                  {allCategoriesSelected ? 'Снять все' : 'Выбрать все'}
                </button>
              </div>
              {preview.categories.map((c) => (
                <label key={c.id} className="im-row">
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                  <span className="im-row-main">
                    <span className="im-row-title">{c.title}</span>
                    <span className="im-row-meta">
                      {c.items_count}{' '}
                      {pluralize(c.items_count, ['позиция', 'позиции', 'позиций'])}
                    </span>
                  </span>
                </label>
              ))}
            </section>
          )}

          {preview.halls.length === 0 && preview.categories.length === 0 && (
            <section className="im-section">
              <p className="im-empty">В этом заведении пока нет ни залов, ни меню.</p>
            </section>
          )}

          <footer className="im-footer">
            <button className="btn btn--ghost" onClick={onResetPreview}>
              Другой код
            </button>
            <button
              className="btn btn--primary im-btn-grow"
              disabled={!hasSelection}
              onClick={onApply}
            >
              {applyLabel}
            </button>
          </footer>
        </>
      )}

      {/* State 3: applying */}
      {applying && (
        <section className="im-section">
          <div className="im-spinner-row">
            <div className="spinner" />
            <p>Копируем…</p>
          </div>
        </section>
      )}
    </div>
  )
}