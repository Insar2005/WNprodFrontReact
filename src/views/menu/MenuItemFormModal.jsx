import { useEffect, useMemo, useRef, useState } from 'react'
import { useMenuStore } from '@/stores/menu'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'

/**
 * Create / edit a menu item. (Was MenuItemFormModal.vue.)
 * - reactive(form) → useState object + setField.
 * - v-model.number on price → Number() in onChange.
 * - category select reads menu.allCategories (derived via useMemo on raw
 *   categories so it stays reactive).
 */
export default function MenuItemFormModal({
  initial = null,
  defaultCategoryId = null,
  onClose,
  onSaved,
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const titleRef = useRef(null)

  const categories = useMenuStore((s) => s.categories)
  const allCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories],
  )

  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    price: initial?.price ?? 0,
    portion: initial?.portion || '',
    description: initial?.description || '',
    is_active: initial?.is_active ?? true,
    category_id: initial?.category_id || defaultCategoryId || '',
  }))
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const r = requestAnimationFrame(() => titleRef.current?.focus())
    return () => cancelAnimationFrame(r)
  }, [])

  const onSubmit = async () => {
    if (saving) return
    const ui = useUiStore.getState()
    const menu = useMenuStore.getState()
    if (!form.category_id) {
      ui.toastError('Выберите категорию')
      return
    }
    setSaving(true)
    try {
      const body = {
        title: form.title,
        price: Number(form.price) || 0,
        portion: form.portion || null,
        description: form.description || null,
      }
      if (isEdit) {
        const patch = { ...body, is_active: form.is_active }
        if (form.category_id !== initial.category_id) {
          patch.category_id = form.category_id
        }
        await menu.updateItem(initial.id, patch)
        ui.toastSuccess('Позиция обновлена')
      } else {
        await menu.createItem(form.category_id, { id: newId(), ...body })
        ui.toastSuccess('Позиция добавлена')
      }
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить позицию?',
      message: 'Действие нельзя отменить.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await useMenuStore.getState().removeItem(initial.id)
      ui.toastSuccess('Позиция удалена')
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <h3 className="sheet-title">
            {isEdit ? 'Редактировать позицию' : 'Новая позиция'}
          </h3>
          <button className="sheet-close" onClick={() => onClose?.()} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="sheet-form">
          <label className="field">
            <span className="field-label">Название</span>
            <input
              ref={titleRef}
              className="field-input"
              type="text"
              placeholder="Например: Капучино"
              maxLength={150}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </label>

          <div className="mn-row">
            <label className="field mn-field-price">
              <span className="field-label">Цена</span>
              <input
                className="field-input"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField('price', Number(e.target.value) || 0)}
              />
            </label>

            <label className="field mn-field-portion">
              <span className="field-label">Порция</span>
              <input
                className="field-input"
                type="text"
                placeholder="200 мл"
                maxLength={50}
                value={form.portion}
                onChange={(e) => setField('portion', e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Описание (необязательно)</span>
            <textarea
              className="field-input mn-textarea"
              rows={3}
              maxLength={2000}
              placeholder="Состав, ингредиенты, особенности"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Категория</span>
            <select
              className="field-input"
              value={form.category_id}
              onChange={(e) => setField('category_id', e.target.value)}
            >
              {allCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </label>

          {isEdit && (
            <label className="mn-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <span>Позиция активна (видна в меню заказа)</span>
            </label>
          )}

          <div className="sheet-actions">
            {isEdit && (
              <button className="btn btn--danger-ghost" onClick={onDelete}>
                Удалить
              </button>
            )}
            <div className="sheet-actions-spacer" />
            <button className="btn btn--ghost" onClick={() => onClose?.()}>
              Отмена
            </button>
            <button className="btn btn--primary" disabled={saving} onClick={onSubmit}>
              {saving ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}