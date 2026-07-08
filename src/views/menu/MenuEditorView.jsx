import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import MenuTwoPanel from './MenuTwoPanel'
import MenuItemRow from './MenuItemRow'
import CategoryFormModal from './CategoryFormModal'
import MenuItemFormModal from './MenuItemFormModal'
import { matchesMenuQueryAcross } from '@/utils/menuSearch'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

/**
 * Menu editor with the two-panel layout (designer redesign, June 2026):
 *   • Left rail: vertical category list + "+ Категория" button.
 *   • Right pane: H2 with selected category title + "Изменить" link,
 *     then the list of items (or an empty-state card).
 *   • FAB "+" floats over the right pane for adding items.
 *
 * The horizontal CategoryChips component is no longer used here. It
 * stays in the repo (unimported) so the older idiom can be revived if
 * needed — e.g. the OrderBuilder may eventually offer a per-workplace
 * setting to pick between horizontal/vertical layouts.
 *
 * Subcategories are not wired here yet — DB still lacks parent_id on
 * MenuCategory. When that lands, the right pane will also render a
 * SubcategoryGrid above the items list per the designer's ScreenRoot
 * mockup.
 */
export default function MenuEditorView() {
  const navigate = useNavigate()

  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')

  const categories = useMenuStore((s) => s.categories)
  const items = useMenuStore((s) => s.items)
  const isLoading = useMenuStore((s) => s.isLoading)
  const selectedCategoryId = useMenuStore((s) => s.selectedCategoryId)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFormVisible, setCategoryFormVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [itemFormVisible, setItemFormVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const allCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories],
  )
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  )
  const selectedItems = useMemo(
    () =>
      selectedCategoryId
        ? items
            .filter((i) => i.category_id === selectedCategoryId)
            .sort((a, b) => a.position - b.position)
        : [],
    [items, selectedCategoryId],
  )
  // Prefix-per-word across title + description + portion. Query "300 г"
// could hit "300 г" in portion of a "Куриный суп"; query "кури" hits
// "куриный" in title. All query terms must land — but they can land
// in different fields.
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

  const openCategoryCreate = () => {
    setEditingCategory(null)
    setCategoryFormVisible(true)
  }
  const openCategoryEdit = (cat) => {
    setEditingCategory(cat)
    setCategoryFormVisible(true)
  }
  const closeCategoryForm = () => {
    setCategoryFormVisible(false)
    setEditingCategory(null)
  }
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
      <header className="menu-header">
        {/* <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button> */}
        <h1 className="menu-title">Меню</h1>
        {currentTitle && <span className="menu-subtitle">{currentTitle}</span>}
        <button
          className="menu-import-btn"
          onClick={() => navigate('/import')}
          title="Импортировать"
          aria-label="Импортировать"
        >
          ⤓
        </button>
      </header>

      {!currentId ? (
        <div className="empty-screen">
          <p>Выберите заведение в Профиле</p>
        </div>
      ) : (
        <>
          <div className="search-wrap menu-search">
            <input
              type="search"
              className="search-input"
              placeholder="Поиск по меню…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Очистить"
              >
                ×
              </button>
            )}
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
          ) : isLoading && allCategories.length === 0 ? (
            <div className="loading">
              <div className="spinner" />
            </div>
          ) : allCategories.length === 0 ? (
            <div className="menu-empty menu-empty--full">
              <p className="empty-text">Меню пустое</p>
              <button className="btn-primary" onClick={openCategoryCreate}>
                Создать первую категорию
              </button>
            </div>
          ) : (
            <MenuTwoPanel
              categories={allCategories}
              selectedId={selectedCategoryId}
              items={selectedItems}
              onSelect={(id) => useMenuStore.getState().selectCategory(id)}
              onAddCategory={openCategoryCreate}
              editable
              bottomInset={80}
              emptyText="В этой категории пока нет позиций"
              headerSlot={
                selectedCategory && (
                  <div className="cat-header">
                    <h2 className="cat-header-title">
                      {selectedCategory.title}
                    </h2>
                    <button
                      className="link-btn"
                      onClick={() => openCategoryEdit(selectedCategory)}
                    >
                      Изменить
                    </button>
                  </div>
                )
              }
              renderItem={(item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  mode="edit"
                  onClick={openItemEdit}
                />
              )}
            />
          )}

          {!searchQuery && selectedCategoryId && (
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
          onClose={closeCategoryForm}
          onSaved={closeCategoryForm}
        />
      )}

      {itemFormVisible && (
        <MenuItemFormModal
          initial={editingItem}
          defaultCategoryId={selectedCategoryId}
          onClose={closeItemForm}
          onSaved={closeItemForm}
        />
      )}
    </div>
  )
}