import { useState } from 'react'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import { TIMEZONES, formatTimezoneOption } from '@/utils/timezones'

/**
 * Create / edit a workplace. Bottom-sheet modal.
 *
 * ── Vue → React notes ───────────────────────────────────────────────
 * - reactive(form) → one useState object + setField(key, value) helper.
 *   (Could split into many useState, but a single object mirrors the Vue
 *   `reactive` and keeps the JSX terse.)
 * - v-model.number on number inputs → value + onChange with Number(...).
 * - props.initial / emit('close','saved') → props initial / onClose / onSaved.
 * - The shared sheet markup (.sheet/.sheet-header/.fm-form…) is styled in
 *   global.css under reusable .sheet-* classes.
 * ─────────────────────────────────────────────────────────────────────
 */

function detectInitialTimezone() {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserTz && TIMEZONES.some((t) => t.id === browserTz)) return browserTz
    const browserOffset = -new Date().getTimezoneOffset()
    const match = TIMEZONES.find((t) => t.offsetMin === browserOffset)
    if (match) return match.id
  } catch {
    /* fallthrough */
  }
  return 'Europe/Moscow'
}

export default function WorkplaceFormModal({ initial = null, onClose, onSaved }) {
  const isEdit = !!initial
  const isCurrentOwner = useWorkplaceStore((s) => s.isCurrentOwner())
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(() => ({
    title: initial?.title || '',
    timezone: initial?.timezone || detectInitialTimezone(),
    currency: initial?.currency || 'RUB',
    service_percent_default: initial?.service_percent_default ?? 0,
    shift_type_default: initial?.shift_type_default || 'fixed',
    pay_for_shift_default: initial?.pay_for_shift_default ?? 0,
  }))

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const onSubmit = async () => {
    if (saving) return
    setSaving(true)
    try {
      const workplace = useWorkplaceStore.getState()
      const ui = useUiStore.getState()
      if (isEdit) {
        await workplace.update(initial.id, { ...form })
        ui.toastSuccess('Изменения сохранены')
      } else {
        await workplace.create({ id: newId(), ...form })
        ui.toastSuccess('Заведение создано')
      }
      onSaved?.()
    } catch (e) {
      useUiStore.getState().toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить заведение?',
      message:
        'Все залы, столы, меню, смены и заказы будут удалены безвозвратно.',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await useWorkplaceStore.getState().remove(initial.id)
      ui.toastSuccess('Удалено')
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
            {isEdit ? 'Редактировать заведение' : 'Новое заведение'}
          </h3>
          <button className="sheet-close" onClick={() => onClose?.()} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="sheet-form">
          <label className="field">
            <span className="field-label">Название</span>
            <input
              className="field-input"
              type="text"
              placeholder="Например: Кофейня на углу"
              maxLength={255}
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Валюта</span>
            <select
              className="field-input"
              value={form.currency}
              onChange={(e) => setField('currency', e.target.value)}
            >
              <option value="RUB">RUB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="KZT">KZT</option>
              <option value="KGS">KGS</option>
              <option value="UAH">UAH</option>
            </select>
          </label>

          <label className="field">
            <span className="field-label">Часовой пояс</span>
            <select
              className="field-input"
              value={form.timezone}
              onChange={(e) => setField('timezone', e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {formatTimezoneOption(tz)}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="fm-fieldset">
            <legend className="fm-legend">Тип оплаты смены</legend>
            <div className="fm-radio-row">
              <label className="fm-radio">
                <input
                  type="radio"
                  name="shift_type_default"
                  value="fixed"
                  checked={form.shift_type_default === 'fixed'}
                  onChange={() => setField('shift_type_default', 'fixed')}
                />
                <span>Фикс. ставка</span>
              </label>
              <label className="fm-radio">
                <input
                  type="radio"
                  name="shift_type_default"
                  value="percent"
                  checked={form.shift_type_default === 'percent'}
                  onChange={() => setField('shift_type_default', 'percent')}
                />
                <span>Процент с продаж</span>
              </label>
            </div>
          </fieldset>

          {form.shift_type_default === 'fixed' ? (
            <label className="field">
              <span className="field-label">Оплата за смену</span>
              <input
                className="field-input"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={form.pay_for_shift_default}
                onChange={(e) =>
                  setField('pay_for_shift_default', Number(e.target.value) || 0)
                }
              />
            </label>
          ) : (
            <label className="field">
              <span className="field-label">Процент с продаж (0–100)</span>
              <input
                className="field-input"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={form.service_percent_default}
                onChange={(e) =>
                  setField(
                    'service_percent_default',
                    Number(e.target.value) || 0,
                  )
                }
              />
            </label>
          )}

          <div className="sheet-actions">
            {isEdit && isCurrentOwner && (
              <button className="btn btn--danger-ghost" onClick={onDelete}>
                Удалить
              </button>
            )}
            <div className="sheet-actions-spacer" />
            <button className="btn btn--ghost" onClick={() => onClose?.()}>
              Отмена
            </button>
            <button className="btn btn--primary" disabled={saving} onClick={onSubmit}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}