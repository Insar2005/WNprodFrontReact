import MenuItemRow from '@/views/menu/MenuItemRow'

/**
 * Thin wrapper around MenuItemRow for OrderBuilder (pick mode).
 *
 * Adds `pathLabel` — optional category breadcrumb shown under the item
 * title. Used only in search results, so the user knows where each found
 * dish lives in the menu ("Капучино · Завтраки › Напитки"). When the
 * category is the active one we don't pass pathLabel — it'd be redundant.
 */
export default function MenuPickRow({
  item,
  currency = 'RUB',
  quantity = 0,
  pathLabel = null,
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
      onClick={onAdd}
      onInfo={onInfo}
    />
  )
}