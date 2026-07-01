import MenuItemRow from '@/views/menu/MenuItemRow'

/**
 * Thin wrapper around MenuItemRow for OrderBuilder (pick mode).
 *
 * Adds `pathLabel` — optional category breadcrumb shown under the item
 * title. Used only in search results, so the user knows where each found
 * dish lives in the menu ("Капучино · Завтраки › Напитки"). When the
 * category is the active one we don't pass pathLabel — it'd be redundant.
 *
 * Also forwards `highlighted` so the search-flow pulse animation reaches
 * the underlying row.
 */
export default function MenuPickRow({
  item,
  currency = 'RUB',
  quantity = 0,
  pathLabel = null,
  highlighted = false,
  onAdd,
  onInfo,
}) {
  return (
    <MenuItemRow
      item={item}
      currency={currency}
      mode="pick"
      quantity={quantity}
      pathLabel={pathLabel}
      highlighted={highlighted}
      onClick={onAdd}
      onInfo={onInfo}
    />
  )
}