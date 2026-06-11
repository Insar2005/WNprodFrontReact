import { useEffect, useRef, useState } from 'react'
import { useMenuStore } from '@/stores/menu'
import { useUiStore } from '@/stores/ui'
import { useWorkplaceStore } from '@/stores/workplace'
import { newId } from '@/utils/nanoid'

/**
 * Create / edit a menu category. (Was CategoryFormModal.vue.)
 * is_active checkbox only shown when editing.
 */
export default function CategoryFormModal({ initial = null, onClose, onSaved }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const titleRef = useRef(null)

  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    is_active: initial?.is_active ?? true,
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
    setSaving(true)
    try {
      if (isEdit) {
        await menu.updateCategory(initial.id, {
          title: form.title,
          is_active: form.is_active,
        })
        ui.toastSuccess('Категория обновлена')
      } else {
        const workplaceId = useWorkplaceStore.getState().currentId
        if (!workplaceId) {
          ui.toastError('Сначала выберите заведение')
          setSaving(false)
          return
        }
        await menu.createCategory(workplaceId, { id: newId(), title: form.title })
        ui.toastSuccess('Категория создана')
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
    const menu = useMenuStore.getState()
    const itemCount = menu.itemsByCategory(initial.id).length
    const message = itemCount
      ? `В категории ${itemCount} позиций — они тоже будут удалены.`
      : 'Эта категория пустая.'
    const ok = await ui.confirm({
      title: 'Удалить категорию?',
      message,
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await menu.removeCategory(initial.id)
      ui.toastSuccess('Категория удалена')
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
            {isEdit ? 'Редактировать категорию' : 'Новая категория'}
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
              placeholder="Например: Закуски"
              maxLength={100}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </label>

          {isEdit && (
            <label className="mn-checkbox">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
              />
              <span>Категория активна (видна в меню заказа)</span>
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