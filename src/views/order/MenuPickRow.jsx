import MenuItemRow from '@/views/menu/MenuItemRow'

/**
 * Thin wrapper around MenuItemRow for OrderBuilder (pick mode).
 *
 * Adds `pathLabel` — optional category breadcrumb shown under the item
 * title. Used only in search results. Forwards `highlighted` for the
 * search-flow pulse, and `onDec` for the slide-out "−" flag (shown when
 * the item is already in the active guest's cart).
 */
export default function MenuPickRow({
  item,
  currency = 'RUB',
  quantity = 0,
  pathLabel = null,
  highlighted = false,
  onAdd,
  onInfo,
  onDec,
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
      onDec={onDec}
    />
  )
}