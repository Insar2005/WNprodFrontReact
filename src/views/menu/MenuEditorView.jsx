import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import { pluralize } from '@/utils/pluralize'
import { buildTree, nodeByPath, labelsForPath, nodeMeta } from '@/utils/menuTree'
import MenuItemRow from './MenuItemRow'
import CategoryFormModal from './CategoryFormModal'
import MenuItemFormModal from './MenuItemFormModal'
import Breadcrumbs from '@/components/menu/Breadcrumbs'
import SubCell from '@/components/menu/SubCell'
import { SectionLabel, AddSubcatButton } from '@/components/menu/SectionBits'
import {
  PlusIcon,
  PencilIcon,
  SearchIcon,
  CloseIcon,
} from '@/components/menu/menuIcons'
import { matchesMenuQueryAcross } from '@/utils/menuSearch'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'
import '@/styles/menu-tree.css'

/**
 * Menu editor — tree layout (July 2026 redesign).
 *
 * Left rail: ROOT categories (vertical). Right pane, per current path:
 *   • Breadcrumbs (when drilled ≥2 deep)
 *   • Current node title (tappable → edit category) + meta line
 *   • "+ Подкатегория" (creates a child of the current node)
 *   • Subcategory cells (drill down)
 *   • "Без подкатегории" label + loose items when the node has both
 *   • FAB "+" adds an item to the CURRENT node
 *
 * Navigation uses the store's path model (setPath/drillInto/
 * navToBreadcrumb). selectedCategoryId still mirrors the last path
 * segment, so modals that read it keep working.
 *
 * Preserved from the previous version: search across title/description/
 * portion, category & item form modals, Telegram back button, import.
 */
export default function MenuEditorView() {
  const navigate = useNavigate()

  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const categories = useMenuStore((s) => s.categories)
  const items = useMenuStore((s) => s.items)
  const isLoading = useMenuStore((s) => s.isLoading)
  const path = useMenuStore((s) => s.path)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFormVisible, setCategoryFormVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [parentForNewCategory, setParentForNewCategory] = useState(null)
  const [itemFormVisible, setItemFormVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Build the tree once from flat state; re-derive on data change only.
  const roots = useMemo(
    () => buildTree(categories, items),
    [categories, items],
  )
  // Root categories for the rail (all of them, active + hidden — editor
  // shows hidden with a dot, per the redesign).
  const rootCats = roots

  // Current node from path; fall back to first root if path is stale.
  const currentNode = useMemo(
    () => nodeByPath(roots, path) || roots[0] || null,
    [roots, path],
  )
  const labels = useMemo(
    () => labelsForPath(roots, path),
    [roots, path],
  )

  const subcats = currentNode?.children ?? []
  const looseItems = currentNode?.items ?? []

  // Prefix-per-word across title + description + portion. All query
  // terms must land, but each may hit a different field.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return []
    return items.filter((i) =>
      matchesMenuQueryAcross([i.title, i.description, i.portion], q),
    )
  }, [items, searchQuery])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/profile')
  }
  useTelegramBackButton(goBack)

  // --- navigation ---
  const selectRoot = (id) => useMenuStore.getState().setPath([id])
  const drillInto = (id) => useMenuStore.getState().drillInto(id)
  const navBreadcrumb = (idx) => useMenuStore.getState().navToBreadcrumb(idx)

  // --- category modals ---
  const openRootCategoryCreate = () => {
    setParentForNewCategory(null)
    setEditingCategory(null)
    setCategoryFormVisible(true)
  }
  const openSubcategoryCreate = () => {
    setParentForNewCategory(currentNode?.id ?? null)
    setEditingCategory(null)
    setCategoryFormVisible(true)
  }
  const openCategoryEdit = (cat) => {
    setParentForNewCategory(null)
    setEditingCategory(cat)
    setCategoryFormVisible(true)
  }
  const closeCategoryForm = () => {
    setCategoryFormVisible(false)
    setEditingCategory(null)
    setParentForNewCategory(null)
  }

  // --- item modals ---
  const openItemCreate = () => {
    setEditingItem(null)
    setItemFormVisible(true)
  }
  const openItemEdit = (item) => {
    setEditingItem(item)
    setItemFormVisible(true)
  }
  const closeItemForm = () => {
    setItemFormVisible(false)
    setEditingItem(null)
  }

  return (
    <div className="page menu-page">
      <header className="wn-topbar menu-header">
        <div className="wn-topbar-main">
          <h1 className="wn-topbar-title">Меню</h1>
          <div className="wn-topbar-sub">
            {currentTitle ? `Редактор · ${currentTitle}` : 'Редактор'}
          </div>
        </div>
        <button
          type="button"
          className="wn-pill-btn"
          onClick={() => navigate('/import')}
        >
          <PlusIcon width={16} height={16} /> Импорт
        </button>
      </header>

      {!currentId ? (
        <div className="empty-screen">
          <p>Выберите заведение в Профиле</p>
        </div>
      ) : (
        <>
          <div className="wn-search">
            <div className="wn-search-box">
              <span className="wn-search-icon" aria-hidden>
                <SearchIcon width={18} height={18} />
              </span>
              <input
                type="search"
                placeholder="Поиск по меню…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wn-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Очистить"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              )}
            </div>
          </div>

          {searchQuery ? (
            <section className="menu-search-results">
              {searchResults.length === 0 ? (
                <div className="menu-empty">
                  <p className="empty-text">Ничего не найдено</p>
                </div>
              ) : (
                <>
                  <p className="menu-search-count">
                    Найдено: {searchResults.length}
                  </p>
                  <div className="menu-items-list">
                    {searchResults.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        mode="edit"
                        onClick={openItemEdit}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : isLoading && rootCats.length === 0 ? (
            <div className="loading">
              <div className="spinner" />
            </div>
          ) : rootCats.length === 0 ? (
            <div className="menu-empty menu-empty--full">
              <p className="empty-text">Меню пустое</p>
              <button className="btn-primary" onClick={openRootCategoryCreate}>
                Создать первую категорию
              </button>
            </div>
          ) : (
            <div className="mtp-wrap" style={{ '--mtp-bottom-inset': '80px' }}>
              {/* LEFT — root categories rail */}
              <nav
                className="mtp-rail"
                role="tablist"
                aria-label="Категории"
              >
                {rootCats.map((cat) => {
                  const isActive = cat.id === path[0]
                  const cls = [
                    'mtp-cat',
                    isActive ? 'mtp-cat--active' : '',
                    !cat.is_active ? 'mtp-cat--inactive' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={cls}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => selectRoot(cat.id)}
                    >
                      <span className="mtp-cat-text">{cat.title}</span>
                      {!cat.is_active && (
                        <span className="mtp-cat-dot" aria-hidden>
                          ●
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="mtp-cat mtp-cat--add"
                  onClick={openRootCategoryCreate}
                >
                  + Категория
                </button>
              </nav>

              {/* RIGHT — current node content */}
              <div className="mtp-pane" style={{ position: 'relative' }}>
                <Breadcrumbs labels={labels} onNav={navBreadcrumb} />

                {currentNode && (
                  <div className="cat-header cat-header--tree">
                    <button
                      type="button"
                      className="cat-title-btn"
                      onClick={() => openCategoryEdit(currentNode)}
                    >
                      <span className="cat-header-title">
                        {currentNode.title}
                      </span>
                      <span className="cat-title-edit" aria-hidden>
                        <PencilIcon width={16} height={16} />
                      </span>
                    </button>
                    <div className="cat-header-meta">
                      {nodeMeta(currentNode, pluralize)}
                    </div>
                  </div>
                )}

                <div className="msub-add-wrap">
                  <AddSubcatButton onClick={openSubcategoryCreate} />
                </div>

                {subcats.length > 0 && (
                  <div className="msub-grid">
                    {subcats.map((s) => (
                      <SubCell
                        key={s.id}
                        node={s}
                        plural={pluralize}
                        onOpen={drillInto}
                      />
                    ))}
                  </div>
                )}

                {looseItems.length > 0 ? (
                  <>
                    {subcats.length > 0 && (
                      <SectionLabel>Без подкатегории</SectionLabel>
                    )}
                    <div className="menu-items-list">
                      {looseItems.map((item) => (
                        <MenuItemRow
                          key={item.id}
                          item={item}
                          currency={currency}
                          mode="edit"
                          onClick={openItemEdit}
                        />
                      ))}
                    </div>
                  </>
                ) : subcats.length === 0 ? (
                  <div className="mtp-empty">
                    Пусто. Добавьте позицию или подкатегорию.
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!searchQuery && currentNode && (
            <button
              className="fab"
              onClick={openItemCreate}
              aria-label="Добавить позицию"
            >
              +
            </button>
          )}
        </>
      )}

      {categoryFormVisible && (
        <CategoryFormModal
          initial={editingCategory}
          parentId={parentForNewCategory}
          onClose={closeCategoryForm}
          onSaved={closeCategoryForm}
        />
      )}

      {itemFormVisible && (
        <MenuItemFormModal
          initial={editingItem}
          defaultCategoryId={currentNode?.id ?? null}
          onClose={closeItemForm}
          onSaved={closeItemForm}
        />
      )}
    </div>
  )
}