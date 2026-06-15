import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMenuStore } from '@/stores/menu'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'
import { formatMoney } from '@/utils/format'
import { hapticImpact } from '@/utils/telegram'
import BottomSheet from '@/components/BottomSheet'
import MenuTwoPanel from '@/views/menu/MenuTwoPanel'
import MenuPickRow from './MenuPickRow'
import CartContent from './CartContent'
import TablePickerSheet from './TablePickerSheet'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

/**
 * Order builder. (Was OrderBuilderView.vue.)
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - Three URL modes via useSearchParams, read once into useState: ?table_id
 *   (new), ?edit_paid (edit a paid order), ?add_to_order (append items).
 * - draft getters are methods → subscribe to raw `draft` + menu raw state,
 *   derive itemCount/total/isEmpty and category/search lists via useMemo;
 *   call draftQuantityOfMenuItem(id) per row.
 * - onMounted setup (shift guard + draft seeding) → a mount effect; it reads
 *   the URL and seeds the store (external system), the allowed effect kind.
 * - cart BottomSheet via ref so the header tap can snapTo(1).
 * - $emit handlers → store actions; post-submit router.replace → navigate.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function OrderBuilderView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const draft = useOrderStore((s) => s.draft)
  const menuItems = useMenuStore((s) => s.items)
  const menuCategories = useMenuStore((s) => s.categories)
  const selectedCategoryId = useMenuStore((s) => s.selectedCategoryId)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')
  const currentId = useWorkplaceStore((s) => s.currentId)

  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tablePickerVisible, setTablePickerVisible] = useState(false)
  const [contextTableNum, setContextTableNum] = useState(null)
  const cartSheetRef = useRef(null)

  const snapPoints = useMemo(() => [180, 0.55, 0.92], [])

  // Read the URL modes once.
  const [editingPaidId] = useState(() => searchParams.get('edit_paid') || null)
  const [addingToOrderId] = useState(() => searchParams.get('add_to_order') || null)

  // === Derived menu lists (getters are methods → derive here) ===
  const allCategories = menuCategories
  const activeCategories = useMemo(
    () => menuCategories.filter((c) => c.is_active),
    [menuCategories],
  )
  const activeItems = useMemo(() => {
    if (!selectedCategoryId) return []
    return menuItems.filter((i) => i.category_id === selectedCategoryId && i.is_active)
  }, [menuItems, selectedCategoryId])

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) return []
    return menuItems
      .filter((i) => i.is_active && i.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [menuItems, searchQuery])

  // === Derived draft values ===
  const draftItems = useMemo(() => draft?.items || [], [draft?.items])
  const draftIsEmpty = draftItems.length === 0
  const draftItemCount = useMemo(
    () => draftItems.reduce((sum, i) => sum + i.quantity, 0),
    [draftItems],
  )
  const draftTotal = useMemo(
    () => draftItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [draftItems],
  )
  const qtyOf = (menuItemId) =>
    draftItems
      .filter((i) => i.menu_item_id === menuItemId)
      .reduce((sum, i) => sum + i.quantity, 0)

  const hallTables = useHallStore((s) => s.tables)
  const hallList = useHallStore((s) => s.halls)
  const draftTableId = draft?.tableId || null
  const selectedTable = useMemo(
    () => (draftTableId ? hallTables.find((t) => t.id === draftTableId) ?? null : null),
    [draftTableId, hallTables],
  )
  const selectedHall = useMemo(
    () =>
      selectedTable
        ? hallList.find((h) => h.id === selectedTable.hall_id) ?? null
        : null,
    [selectedTable, hallList],
  )

  const canSubmit = !draftIsEmpty

  // === Mount setup: shift guard + draft seeding (reads URL, seeds store) ===
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    const hall = useHallStore.getState()

    if (!useShiftStore.getState().isOpen()) {
      ui.toastError('Откройте смену, чтобы принимать заказы')
      navigate('/shifts', { replace: true })
      return
    }

    if (editingPaidId) {
      const o = order.orderById(editingPaidId)
      if (!o || !o.is_paid) {
        ui.toastError('Закрытый заказ не найден')
        navigate('/order-history', { replace: true })
        return
      }
      setContextTableNum(o.table_number || null)
      order.replaceDraftWithPaidOrder(o)
      return
    }

    if (addingToOrderId) {
      const o = order.orderById(addingToOrderId)
      if (!o || o.is_paid) {
        ui.toastError('Активный заказ не найден')
        navigate('/map', { replace: true })
        return
      }
      setContextTableNum(o.table_number || null)
      order.replaceDraftEphemeral({ tableId: o.table_id || null, hallId: o.hall_id || null })
      return
    }

    const queryTableId = searchParams.get('table_id')
    if (!order.draft) {
      if (queryTableId) {
        const t = hall.tableById(queryTableId)
        order.startDraft({ tableId: t?.id || null, hallId: t?.hall_id || null })
      } else {
        order.startDraft()
      }
    } else if (queryTableId) {
      const t = hall.tableById(queryTableId)
      if (t && t.id !== order.draft.tableId) {
        order.setDraftTable(t.id, t.hall_id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Default-select a category once the menu loads.
  useEffect(() => {
    if (allCategories.length > 0 && !selectedCategoryId) {
      const first = activeCategories[0]?.id || allCategories[0]?.id
      if (first) useMenuStore.getState().selectCategory(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCategories.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // === Actions ===
  const onAddToCart = (item) => {
    useOrderStore.getState().addToDraft(item)
    hapticImpact('light')
  }

  const onSubmit = async () => {
    if (!canSubmit || submitting) return
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    setSubmitting(true)
    try {
      if (addingToOrderId) {
        const items = (order.draft?.items || []).map((i) => ({
          menu_item_id: i.menu_item_id,
          title: i.title,
          price: i.price,
          quantity: i.quantity,
          comment: i.comment || null,
        }))
        const updated = await order.addItemsToOrder(addingToOrderId, items)
        order.clearDraft()
        ui.toastSuccess(
          `Добавлено к заказу${updated.table_number ? ` · стол №${updated.table_number}` : ''}`,
        )
        if (updated.table_id) {
          navigate(`/map?show_order=${encodeURIComponent(updated.id)}`, { replace: true })
        } else {
          navigate('/map', { replace: true })
        }
        return
      }

      if (editingPaidId) {
        const patch = {
          items: (order.draft?.items || []).map((i) => ({
            id: i.id,
            menu_item_id: i.menu_item_id,
            title: i.title,
            price: i.price,
            quantity: i.quantity,
            comment: i.comment || null,
          })),
          comments: order.draft?.comments || null,
        }
        await order.editPaidOrder(editingPaidId, patch)
        order.clearDraft()
        ui.toastSuccess('Изменения сохранены')
        navigate('/order-history', { replace: true })
        return
      }

      const created = await order.submitDraft({ workplaceId: currentId })
      ui.toastSuccess(
        `Заказ принят${created.table_number ? ` · стол №${created.table_number}` : ''}`,
      )
      if (created.table_id) {
        navigate(`/map?highlight_table=${encodeURIComponent(created.table_id)}`, {
          replace: true,
        })
      } else {
        navigate('/map', { replace: true })
      }
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const editOrderComment = async () => {
    const order = useOrderStore.getState()
    const value = await useUiStore.getState().prompt({
      title: 'Комментарий к заказу',
      initial: order.draft?.comments || '',
      placeholder: 'Например: гость справа, оплата картой',
      multiline: true,
      rows: 3,
      maxLength: 2000,
      confirmText: 'Сохранить',
    })
    if (value === null) return
    order.setDraftComments(value.trim() || '')
  }

  const onClearDraft = async () => {
    const order = useOrderStore.getState()
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Очистить корзину?',
      message: 'Все добавленные позиции будут удалены.',
      confirmText: 'Очистить',
      danger: true,
    })
    if (!ok) return
    if (addingToOrderId) {
      const o = order.orderById(addingToOrderId)
      order.replaceDraftEphemeral({
        tableId: o?.table_id || null,
        hallId: o?.hall_id || null,
      })
    } else {
      order.clearDraft()
      order.startDraft()
    }
  }

  const onTableSelect = (tableId) => {
    const order = useOrderStore.getState()
    if (tableId == null) {
      order.setDraftTable(null, null)
    } else {
      const t = useHallStore.getState().tableById(tableId)
      if (t) order.setDraftTable(t.id, t.hall_id)
    }
    setTablePickerVisible(false)
  }

  const expandCart = () => cartSheetRef.current?.snapTo(1)
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/map')
  }
  const goToMenuEditor = () => navigate('/menu')

  const title = editingPaidId
    ? `Изменение заказа${contextTableNum ? ` · стол №${contextTableNum}` : ''}`
    : addingToOrderId
      ? `+ к заказу${contextTableNum ? ` · стол №${contextTableNum}` : ''}`
      : 'Новый заказ'

  const submitLabel = submitting
    ? editingPaidId
      ? 'Сохраняем…'
      : addingToOrderId
        ? 'Добавляем…'
        : 'Создаём…'
    : editingPaidId
      ? `Сохранить изменения · ${formatMoney(draftTotal, currency)}`
      : addingToOrderId
        ? `Добавить к заказу · ${formatMoney(draftTotal, currency)}`
        : `Собрать заказ · ${formatMoney(draftTotal, currency)}`

  // === Cart sheet header + footer ===
  const cartHeader = (
    <>
      <div className="ob-cart-header" onClick={expandCart}>
        <div className="ob-cart-summary">
          <span className="ob-cart-count">
            {draftItemCount} {pluralize(draftItemCount, ['позиция', 'позиции', 'позиций'])}
          </span>
          <span className="ob-cart-total">{formatMoney(draftTotal, currency)}</span>
        </div>
      </div>

      {!editingPaidId && !addingToOrderId ? (
        <button className="ob-table-plate" onClick={() => setTablePickerVisible(true)}>
          <span className="ob-table-plate-icon">🪑</span>
          {selectedTable ? (
            <span className="ob-table-plate-text">
              Стол №{selectedTable.number}
              {selectedHall && <small> · {selectedHall.name}</small>}
            </span>
          ) : (
            <span className="ob-table-plate-text ob-table-plate-text--empty">
              Стол не выбран
            </span>
          )}
          <span className="ob-table-plate-edit">✏️</span>
        </button>
      ) : (
        contextTableNum && (
          <div className="ob-table-plate ob-table-plate--readonly">
            <span className="ob-table-plate-icon">🪑</span>
            <span className="ob-table-plate-text">Стол №{contextTableNum}</span>
          </div>
        )
      )}
    </>
  )

  const cartFooter = (
    <button className="ob-submit-btn" disabled={!canSubmit || submitting} onClick={onSubmit}>
      {submitLabel}
    </button>
  )

  return (
    <div className="ob-page">
      <header className="ob-header">
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
        <h1 className="ob-title">{title}</h1>
        {!draftIsEmpty && !editingPaidId && (
          <button className="ob-clear-btn" onClick={onClearDraft} aria-label="Очистить корзину">
            Очистить
          </button>
        )}
      </header>

      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по меню…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      {searchQuery ? (
        <section className="ob-search-results">
          {searchResults.length === 0 ? (
            <div className="ob-empty">
              <p>Ничего не найдено</p>
            </div>
          ) : (
            <>
              <p className="ob-search-count">Найдено: {searchResults.length}</p>
              <div className="ob-items">
                {searchResults.map((item) => (
                  <MenuPickRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    quantity={qtyOf(item.id)}
                    onAdd={onAddToCart}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      ) : (
    <>
      {activeCategories.length === 0 ? (
        <div className="ob-empty ob-empty--centered">
          <p>В меню нет активных категорий.</p>
          <button className="btn-link" onClick={goToMenuEditor}>
            Открыть редактор
          </button>
        </div>
      ) : (
        <MenuTwoPanel
          categories={activeCategories}
          selectedId={selectedCategoryId}
          items={activeItems}
          onSelect={(id) => useMenuStore.getState().selectCategory(id)}
          emptyText="В этой категории пока нет позиций"
          itemSlot={(item) => (
            <MenuPickRow
              key={item.id}
              item={item}
              currency={currency}
              quantity={qtyOf(item.id)}
              onAdd={onAddToCart}
            />
          )}
        />
      )}
    </>
  )}

      <BottomSheet
        ref={cartSheetRef}
        visible={true}
        snapPoints={snapPoints}
        initialSnap={0}
        header={cartHeader}
        footer={cartFooter}
      >
        <CartContent
          items={draftItems}
          currency={currency}
          onInc={(id) => useOrderStore.getState().incDraftItem(id)}
          onDec={(id) => useOrderStore.getState().decDraftItem(id)}
          onUpdateComment={(id, comment) =>
            useOrderStore.getState().updateDraftItem(id, { comment })
          }
        />

        {!draftIsEmpty && (
          <div className="ob-order-comment">
            <span className="ob-order-comment-label">Комментарий к заказу</span>
            <button
              className={
                draft?.comments
                  ? 'ob-order-comment-btn'
                  : 'ob-order-comment-btn ob-order-comment-btn--empty'
              }
              onClick={editOrderComment}
            >
              {draft?.comments ? (
                <span className="ob-order-comment-text">💬 {draft.comments}</span>
              ) : (
                <span className="ob-order-comment-placeholder">+ Добавить комментарий</span>
              )}
            </button>
          </div>
        )}
      </BottomSheet>

      <TablePickerSheet
        visible={tablePickerVisible}
        currentTableId={draft?.tableId}
        freeOnly={true}
        onClose={() => setTablePickerVisible(false)}
        onSelect={onTableSelect}
      />
    </div>
  )
}