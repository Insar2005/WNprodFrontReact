import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useMenuStore } from '@/stores/menu'
import MenuTwoPanel from './MenuTwoPanel'
import MenuItemRow from './MenuItemRow'
import CategoryFormModal from './CategoryFormModal'
import MenuItemFormModal from './MenuItemFormModal'

/**
 * Menu editor. (Was MenuEditorView.vue.)
 * - menu store getters are methods returning fresh arrays, so we subscribe
 *   to raw categories/items/selectedCategoryId and derive with useMemo.
 * - searchResults: live filter over items (was a computed wrapping
 *   menu.searchItems).
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
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.portion || '').toLowerCase().includes(q),
    )
  }, [items, searchQuery])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/profile')
  }

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
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
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
                  <p className="menu-search-count">Найдено: {searchResults.length}</p>
                  <div className="menu-items-list">
                    {searchResults.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        onEdit={openItemEdit}
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
          emptyText="В этой категории пока нет позиций"
          headerSlot={
            selectedCategory && (
              <div className="menu-cat-actions">
                <span className="menu-cat-name">
                  {selectedCategory.title}
                </span>
                <button
                  className="link-btn"
                  onClick={() => openCategoryEdit(selectedCategory)}
                >
                  Изменить
                </button>
              </div>
            )
          }
          itemSlot={(item) => (
            <MenuItemRow
              key={item.id}
              item={item}
              currency={currency}
              onEdit={openItemEdit}
            />
          )}
        />
          )}

          {!searchQuery && selectedCategoryId && (
            <button className="fab" onClick={openItemCreate} aria-label="Добавить позицию">
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