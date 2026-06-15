import MenuItemRow from '@/views/menu/MenuItemRow'

/**
 * Thin wrapper around the universal MenuItemRow in pick mode.
 *
 * Kept as a separate file so OrderBuilderView (and any other callers)
 * don't need to change their imports. The Vue→React port had two
 * separate row components; the new design unifies them, but keeping
 * this wrapper means the migration is non-breaking.
 *
 * onAdd → onClick (the pick row's "primary" action is adding to cart).
 * onInfo passes through for the ⓘ button when the caller is ready to
 * wire EditAndSeeMoreModal.
 */
export default function MenuPickRow({
  item,
  currency = 'RUB',
  quantity = 0,
  onAdd,
  onInfo,
}) {
  return (
    <MenuItemRow
      item={item}
      currency={currency}
      mode="pick"
      quantity={quantity}
      onClick={onAdd}
      onInfo={onInfo}
    />
  )
}