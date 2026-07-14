import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMenuStore } from '@/stores/menu'
import { useOrderStore } from '@/stores/order'
import { useHallStore } from '@/stores/hall'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'
import { hapticImpact } from '@/utils/telegram'
import { pluralize } from '@/utils/pluralize'
import { buildTree, nodeByPath, labelsForPath } from '@/utils/menuTree'
import MenuPickRow from './MenuPickRow'
import SearchWithTopOfShift from './SearchWithTopOfShift'
import { matchesMenuQuery } from '@/utils/menuSearch'
import CartContent from './CartContent'
import CartSheet from './CartSheet'
import CollectSheet from './CollectSheet'
import CommentModal from './CommentModal'
import ItemViewModal from './ItemViewModal'
import { GuestBar } from './OrderGuests'
import Breadcrumbs from '@/components/menu/Breadcrumbs'
import SubCell from '@/components/menu/SubCell'
import { SectionLabel } from '@/components/menu/SectionBits'
import '@/styles/order-builder.css'
import '@/styles/menu-tree.css'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

/**
 * Сборка заказа — 1:1 по menu-redesign (proto-screens.jsx OrderBuilder).
 *
 * Июль 2026, вторая итерация («точь-в-точь»):
 *   • Шапка = proto TopBar: заголовок 17/600 + подзаголовок 12 mute,
 *     справа пилюля «Очистить» (danger) при непустой корзине.
 *   • Диалога «Сколько гостей?» больше НЕТ — число гостей задаётся
 *     только GuestBar («＋» добавляет, «×» удаляет), как в прототипе.
 *   • ⓘ на карточке открывает ItemViewModal (read-only + «Добавить в
 *     заказ»), а НЕ комментарий. Комментарии — только из строк корзины.
 *   • Карточка позиции без заливки при qty>0: бейдж у названия +
 *     выезжающий «−» (см. MenuItemRow).
 *   • Корзина — НЕ draggable: обычный блок внизу (CartSheet), тап по
 *     полосе «Заказ» раскрывает до 60vh. Стол и комментарий к заказу
 *     вынесены в CollectSheet («Оформление заказа») по кнопке «Собрать».
 *
 * Не тронуто (не регрессировать): три URL-режима (?table_id /
 * ?edit_paid / ?add_to_order), посев черновика на маунте, удаление
 * гостя с перенумерацией и confirm, highlight из поиска, выбор стола,
 * комментарий к заказу, скрытие шита при поиске.
 */
export default function OrderBuilderView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const draft = useOrderStore((s) => s.draft)
  const orders = useOrderStore((s) => s.orders)
  const menuItems = useMenuStore((s) => s.items)
  const menuCategories = useMenuStore((s) => s.categories)
  const path = useMenuStore((s) => s.path)
  const highlightedItemId = useMenuStore((s) => s.highlightedItemId)
  const currency = useWorkplaceStore((s) => s.current()?.currency ?? 'RUB')
  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentTitle = useWorkplaceStore((s) => s.current()?.title ?? '')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [contextTableNum, setContextTableNum] = useState(null)
  const [selectedGuest, setSelectedGuest] = useState(1)
  const [commentTarget, setCommentTarget] = useState(null)
  const [viewItem, setViewItem] = useState(null) // ⓘ → ItemViewModal
  const [cartExpanded, setCartExpanded] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false) // «Оформление заказа»

  const isSearching = searchQuery.trim() !== ''
  const searchActive = isSearching || searchFocused

  const [editingPaidId] = useState(() => searchParams.get('edit_paid') || null)
  const [addingToOrderId] = useState(
    () => searchParams.get('add_to_order') || null,
  )

  // === Дерево ===
  // Только активные категории/позиции. buildTree сохраняет position.
  const activeCats = useMemo(
    () => menuCategories.filter((c) => c.is_active),
    [menuCategories],
  )
  const activeItemsAll = useMemo(
    () => menuItems.filter((i) => i.is_active),
    [menuItems],
  )
  const roots = useMemo(
    () => buildTree(activeCats, activeItemsAll),
    [activeCats, activeItemsAll],
  )
  const currentNode = useMemo(
    () => nodeByPath(roots, path) || roots[0] || null,
    [roots, path],
  )
  const labels = useMemo(() => labelsForPath(roots, path), [roots, path])
  const subcats = currentNode?.children ?? []
  const looseItems = currentNode?.items ?? []

  const categoryById = useMemo(() => {
    const m = {}
    for (const c of menuCategories) m[c.id] = c
    return m
  }, [menuCategories])

  // Полный путь категории «Родитель › Дитя» для результатов поиска и
  // карточки позиции (в прототипе показывается весь путь).
  const fullPathLabel = (categoryId) => {
    const parts = []
    let cur = categoryById[categoryId]
    let guard = 0
    while (cur && guard < 100) {
      parts.unshift(cur.title)
      cur = cur.parent_id ? categoryById[cur.parent_id] : null
      guard += 1
    }
    return parts.join(' › ') || null
  }

  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim()
    if (!q) return []
    return menuItems
      .filter((i) => i.is_active && matchesMenuQuery(i.title, q))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [menuItems, searchQuery])

  // === Производные от черновика ===
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
  const guestCount = draft?.guestCount || 1
  const activeGuest = Math.min(selectedGuest, guestCount) || 1

  const contextItems = useMemo(() => {
    if (!addingToOrderId) return []
    return orders.find((o) => o.id === addingToOrderId)?.items || []
  }, [addingToOrderId, orders])

  const qtyOf = (menuItemId) =>
    draftItems
      .filter(
        (i) => i.menu_item_id === menuItemId && (i.guest || 1) === activeGuest,
      )
      .reduce((sum, i) => sum + i.quantity, 0)

  const guestCounts = useMemo(() => {
    const m = {}
    for (const i of draftItems) {
      const g = i.guest || 1
      m[g] = (m[g] || 0) + i.quantity
    }
    return m
  }, [draftItems])

  const hallTables = useHallStore((s) => s.tables)
  const hallList = useHallStore((s) => s.halls)
  const draftTableId = draft?.tableId || null
  const selectedTable = useMemo(
    () =>
      draftTableId ? hallTables.find((t) => t.id === draftTableId) ?? null : null,
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

  // === Маунт: guard смены + посев черновика ===
  // Диалог количества гостей убран (прототип): черновик стартует с
  // одним гостем («Один чек»), дальше — только через GuestBar.
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
      order.replaceDraftEphemeral({
        tableId: o.table_id || null,
        hallId: o.hall_id || null,
        guestsCount: o.guests_count || 1,
      })
      return
    }

    const queryTableId = searchParams.get('table_id')
    const d = order.draft
    const draftHasItems = !!d && d.items.length > 0
    if (queryTableId) {
      const t = hall.tableById(queryTableId)
      const tid = t?.id || null
      if (!d || d.tableId !== tid) {
        order.startDraft({ tableId: tid, hallId: t?.hall_id || null })
      }
    } else if (!d || !draftHasItems) {
      order.startDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автовыбор первой корневой категории после загрузки меню.
  useEffect(() => {
    if (roots.length > 0 && path.length === 0) {
      useMenuStore.getState().setPath([roots[0].id])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // === Действия ===
  const onAddToCart = (item) => {
    useOrderStore.getState().addToDraft(item, { guest: activeGuest })
    hapticImpact('light')
  }

  // Выезжающий «−»: убавить блюдо активному гостю.
  const onDecItem = (item) => {
    useOrderStore.getState().decDraftItemForGuest(item.id, activeGuest)
    hapticImpact('light')
  }

  const onPickFromSearch = (item) => {
    if (typeof document !== 'undefined' && document.activeElement?.blur) {
      document.activeElement.blur()
    }
    setSearchQuery('')
    // selectCategory разворачивает полный путь до (возможно вложенной)
    // категории и сбрасывает прежний highlight; потом ставим новый.
    useMenuStore.getState().selectCategory(item.category_id)
    useMenuStore.getState().highlightItem(item.id)
    onAddToCart(item)
  }

  const onAddGuest = () => {
    useOrderStore.getState().addGuest()
    setSelectedGuest(useOrderStore.getState().draft?.guestCount || 1)
  }

  const onRemoveGuest = async (g) => {
    const order = useOrderStore.getState()
    const hasItems = (order.draft?.items || []).some(
      (i) => (i.guest || 1) === g,
    )
    const ok = await useUiStore.getState().confirm({
      title: `Удалить гостя ${g}?`,
      message: hasItems
        ? 'Позиции этого гостя будут удалены из заказа.'
        : 'Гость будет удалён, остальные перенумеруются.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (!ok) return
    order.removeGuest(g)
    setSelectedGuest((s) => Math.min(s, order.draft?.guestCount || 1) || 1)
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
          guest: i.guest || 1,
        }))
        const updated = await order.addItemsToOrder(addingToOrderId, items)
        order.clearDraft()
        ui.toastSuccess(
          `Добавлено к заказу${updated.table_number ? ` · стол №${updated.table_number}` : ''}`,
        )
        if (updated.table_id) {
          navigate(`/map?show_order=${encodeURIComponent(updated.id)}`, {
            replace: true,
          })
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
            guest: i.guest || 1,
          })),
          guests_count: order.draft?.guestCount || 1,
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
        navigate(
          `/map?highlight_table=${encodeURIComponent(created.table_id)}`,
          { replace: true },
        )
      } else {
        navigate('/map', { replace: true })
      }
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const onClearDraft = async () => {
    const order = useOrderStore.getState()
    const ok = await useUiStore.getState().confirm({
      title: 'Очистить корзину?',
      message: 'Все позиции и комментарии будут удалены.',
      confirmText: 'Очистить',
      danger: true,
    })
    if (!ok) return
    if (addingToOrderId) {
      const o = order.orderById(addingToOrderId)
      order.replaceDraftEphemeral({
        tableId: o?.table_id || null,
        hallId: o?.hall_id || null,
        guestsCount: o?.guests_count || order.draft?.guestCount || 1,
      })
    } else {
      order.clearDraftItems()
    }
  }

  // Кнопка в футере корзины: новый заказ и правка закрытого идут через
  // CollectSheet (стол/комментарий); добавление к существующему заказу —
  // сразу сабмит (стол уже есть, комментарий в этом режиме API не шлёт).
  const handlePrimary = () => {
    if (!canSubmit || submitting) return
    if (addingToOrderId) {
      onSubmit()
    } else {
      setCollectOpen(true)
    }
  }

  // Подтверждение из CollectSheet: пишем стол/комментарий в черновик и
  // отправляем. onSubmit читает store свежим getState(), так что патч
  // уйдёт уже с этими значениями. При ошибке шит остаётся открытым.
  const handleCollectConfirm = async ({ tableId, comment }) => {
    const order = useOrderStore.getState()
    if (!editingPaidId) {
      if (tableId == null) {
        order.setDraftTable(null, null)
      } else {
        const t = useHallStore.getState().tableById(tableId)
        if (t) order.setDraftTable(t.id, t.hall_id)
      }
    }
    order.setDraftComments(comment || '')
    await onSubmit()
    setCollectOpen(false)
  }
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/map')
  }
  useTelegramBackButton(goBack)
  const goToMenuEditor = () => navigate('/menu')

  // Навигация по дереву
  const onSelectCategory = (id) => {
    if (typeof document !== 'undefined' && document.activeElement?.blur) {
      document.activeElement.blur()
    }
    useMenuStore.getState().setPath([id])
  }
  const drillInto = (id) => useMenuStore.getState().drillInto(id)
  const navBreadcrumb = (idx) => useMenuStore.getState().navToBreadcrumb(idx)

  // ⓘ → ItemViewModal (read-only карточка + «Добавить в заказ»).
  const openItemView = (menuItem) => setViewItem(menuItem)

  // Комментарий — только из строки корзины (как в прототипе).
  const openCommentFromCart = (lineItem) => {
    // Достаём позицию меню ради её comment_chips.
    const menuItem =
      menuItems.find((m) => m.id === lineItem.menu_item_id) || {
        title: lineItem.title,
        comment_chips: [],
      }
    setCommentTarget({
      item: { ...menuItem, title: menuItem.title || lineItem.title },
      lineId: lineItem.id,
    })
  }

  const saveComment = (text) => {
    const t = commentTarget
    if (t?.lineId) {
      useOrderStore.getState().updateDraftItem(t.lineId, {
        comment: text || null,
      })
    }
    setCommentTarget(null)
  }

  // === Тексты ===
  const title = editingPaidId
    ? 'Изменение заказа'
    : addingToOrderId
      ? 'Добавление к заказу'
      : 'Новый заказ'

  const subtitle = editingPaidId || addingToOrderId
    ? contextTableNum
      ? `Стол №${contextTableNum}`
      : currentTitle
    : selectedTable
      ? `Стол №${selectedTable.number}${selectedHall ? ` · ${selectedHall.name}` : ''}`
      : currentTitle

  const submitLabel = submitting
    ? '…'
    : editingPaidId
      ? 'Сохранить'
      : addingToOrderId
        ? 'Добавить'
        : 'Собрать'

  const cartEmpty = draftIsEmpty && contextItems.length === 0

  const cartBarMeta = draftItemCount > 0
    ? `${draftItemCount} ${pluralize(draftItemCount, ['позиция', 'позиции', 'позиций'])}${
        guestCount > 1 ? ` · ${guestCount} ${pluralize(guestCount, ['гость', 'гостя', 'гостей'])}` : ''
      }`
    : 'Корзина пуста'

  return (
    <div className="ob-page">
      <header className="wn-topbar ob-header">
        <div className="wn-topbar-main">
          <h1 className="wn-topbar-title">{title}</h1>
          {subtitle && <div className="wn-topbar-sub">{subtitle}</div>}
        </div>
        {!draftIsEmpty && !editingPaidId && (
          <button
            type="button"
            className="wn-pill-btn wn-pill-btn--danger"
            onClick={onClearDraft}
            aria-label="Очистить корзину"
          >
            Очистить
          </button>
        )}
      </header>

      <GuestBar
        guestCount={guestCount}
        selected={activeGuest}
        counts={guestCounts}
        onSelect={setSelectedGuest}
        onAdd={onAddGuest}
        onRemove={onRemoveGuest}
      />

      <SearchWithTopOfShift
        value={searchQuery}
        onChange={setSearchQuery}
        onFocusChange={setSearchFocused}
      />

      {isSearching ? (
        <section className="ob-search-results">
          <SectionLabel>
            {searchResults.length > 0
              ? `Найдено: ${searchResults.length}`
              : 'Ничего не найдено'}
          </SectionLabel>
          {searchResults.length === 0 ? (
            <div className="ob-empty">
              <p>Попробуйте другой запрос.</p>
            </div>
          ) : (
            <div className="ob-items">
              {searchResults.map((item) => (
                <MenuPickRow
                  key={item.id}
                  item={item}
                  currency={currency}
                  quantity={qtyOf(item.id)}
                  pathLabel={fullPathLabel(item.category_id)}
                  onAdd={onPickFromSearch}
                  onInfo={openItemView}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {roots.length === 0 ? (
            <div className="ob-empty ob-empty--centered">
              <p>В меню нет активных категорий.</p>
              <button className="btn-link" onClick={goToMenuEditor}>
                Открыть редактор
              </button>
            </div>
          ) : (
            <div className="mtp-wrap">
              {/* СЛЕВА — рельса корневых категорий */}
              <nav className="mtp-rail" role="tablist" aria-label="Категории">
                {roots.map((cat) => {
                  const isActive = cat.id === path[0]
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`mtp-cat${isActive ? ' mtp-cat--active' : ''}`}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onSelectCategory(cat.id)}
                    >
                      <span className="mtp-cat-text">{cat.title}</span>
                    </button>
                  )
                })}
              </nav>

              {/* СПРАВА — содержимое текущего узла */}
              <div className="mtp-pane" style={{ position: 'relative' }}>
                <Breadcrumbs labels={labels} onNav={navBreadcrumb} />

                {currentNode && (
                  <h1 className="ob-node-title">{currentNode.title}</h1>
                )}

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
                  <div className="ob-items">
                    {looseItems.map((item) => (
                      <MenuPickRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        quantity={qtyOf(item.id)}
                        highlighted={item.id === highlightedItemId}
                        onAdd={onAddToCart}
                        onInfo={openItemView}
                        onDec={onDecItem}
                      />
                    ))}
                  </div>
                ) : subcats.length === 0 ? (
                  <div className="mtp-empty">Нет доступных позиций.</div>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}

      {/* Корзина — обычный блок внизу страницы (не draggable). На время
          поиска скрыта, чтобы не мешать клавиатуре. */}
      {!searchActive && (
        <CartSheet
          empty={cartEmpty}
          meta={cartBarMeta}
          total={draftTotal}
          currency={currency}
          expanded={cartExpanded && !cartEmpty}
          onToggle={() => setCartExpanded((v) => !v)}
          submitLabel={submitLabel}
          canSubmit={canSubmit}
          submitting={submitting}
          onSubmit={handlePrimary}
        >
          <CartContent
            items={draftItems}
            contextItems={contextItems}
            currency={currency}
            guestCount={guestCount}
            onInc={(id) => useOrderStore.getState().incDraftItem(id)}
            onDec={(id) => useOrderStore.getState().decDraftItem(id)}
            onOpenComment={openCommentFromCart}
          />
        </CartSheet>
      )}

      {collectOpen && (
        <CollectSheet
          mode={editingPaidId ? 'edit' : 'new'}
          initialTableId={draft?.tableId || null}
          initialComment={draft?.comments || ''}
          count={draftItemCount}
          total={draftTotal}
          currency={currency}
          submitting={submitting}
          onClose={() => setCollectOpen(false)}
          onConfirm={handleCollectConfirm}
        />
      )}

      {viewItem && (
        <ItemViewModal
          item={viewItem}
          pathLabel={fullPathLabel(viewItem.category_id)}
          qty={qtyOf(viewItem.id)}
          currency={currency}
          onClose={() => setViewItem(null)}
          onAdd={() => onAddToCart(viewItem)}
        />
      )}

      {commentTarget && (
        <CommentModal
          item={commentTarget.item}
          initial={
            draftItems.find((i) => i.id === commentTarget.lineId)?.comment || ''
          }
          onClose={() => setCommentTarget(null)}
          onSave={saveComment}
        />
      )}
    </div>
  )
}
