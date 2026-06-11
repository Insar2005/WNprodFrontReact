import { useEffect, useRef, useState } from 'react'
import { useNotesStore } from '@/stores/notes'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'

/**
 * Create / edit a note. (Was NoteFormModal.vue.)
 * - reactive(form) → useState object + setField.
 * - On create: scope is selectable (radios). On edit: scope is read-only.
 * - Pin toggled via the header button; archive/delete are footer actions.
 * - titleInput focus on mount → useRef + useEffect.
 */

function scopeBadgeLabel(scope) {
  switch (scope) {
    case 'shift':
      return 'Привязана к смене'
    case 'workplace':
      return 'Привязана к заведению'
    case 'global':
      return 'Личная заметка'
    default:
      return ''
  }
}

export default function NoteFormModal({
  initial = null,
  defaultScope = 'global',
  onClose,
  onSaved,
}) {
  const isEdit = !!initial
  const [busy, setBusy] = useState(false)
  const titleRef = useRef(null)

  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentShift = useShiftStore((s) => s.current)

  const [form, setForm] = useState(() => ({
    header: initial?.header || '',
    content: initial?.content || '',
    pinned: initial?.pinned ?? false,
    is_archived: initial?.is_archived ?? false,
    scope: initial?.scope || defaultScope || 'global',
  }))
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const r = requestAnimationFrame(() => titleRef.current?.focus())
    return () => cancelAnimationFrame(r)
  }, [])

  const onSubmit = async () => {
    if (busy) return
    const ui = useUiStore.getState()
    const notes = useNotesStore.getState()
    setBusy(true)
    try {
      if (isEdit) {
        await notes.update(initial.id, {
          header: form.header,
          content: form.content || null,
          pinned: form.pinned,
        })
        ui.toastSuccess('Сохранено')
      } else {
        const body = {
          id: newId(),
          scope: form.scope,
          header: form.header,
          content: form.content || null,
          pinned: form.pinned,
        }
        if (form.scope === 'workplace') {
          if (!currentId) {
            ui.toastError('Нет текущего заведения')
            setBusy(false)
            return
          }
          body.workplace_id = currentId
        } else if (form.scope === 'shift') {
          if (!currentShift) {
            ui.toastError('Нет открытой смены')
            setBusy(false)
            return
          }
          body.shift_id = currentShift.id
          body.workplace_id = currentShift.workplace_id
        }
        await notes.create(body)
        ui.toastSuccess('Заметка создана')
      }
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onArchive = async () => {
    if (!initial) return
    const ui = useUiStore.getState()
    setBusy(true)
    try {
      await useNotesStore.getState().toggleArchive(initial.id)
      ui.toastSuccess(form.is_archived ? 'Восстановлено' : 'В архиве')
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async () => {
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: 'Удалить заметку?',
      message: 'Действие нельзя отменить.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await useNotesStore.getState().remove(initial.id)
      ui.toastSuccess('Удалено')
      onSaved?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.()
  }

  return (
    <div className="sheet-overlay" onClick={onOverlayClick}>
      <div className="sheet" role="dialog" aria-modal="true">
        <header className="sheet-header">
          <button
            className={form.pinned ? 'nf-pin nf-pin--active' : 'nf-pin'}
            onClick={() => setField('pinned', !form.pinned)}
            aria-label="Закрепить"
          >
            📌
          </button>
          <h3 className="sheet-title">{isEdit ? 'Заметка' : 'Новая заметка'}</h3>
          <button className="sheet-close" onClick={() => onClose?.()} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="sheet-form">
          <input
            ref={titleRef}
            className="field-input nf-title-input"
            type="text"
            placeholder="Заголовок"
            maxLength={255}
            value={form.header}
            onChange={(e) => setField('header', e.target.value)}
          />

          <textarea
            className="field-input nf-content-input"
            placeholder="Текст заметки…"
            rows={6}
            value={form.content}
            onChange={(e) => setField('content', e.target.value)}
          />

          {!isEdit ? (
            <fieldset className="fm-fieldset">
              <legend className="fm-legend">Привязка</legend>
              <div className="fm-radio-row">
                <label className="fm-radio">
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === 'global'}
                    onChange={() => setField('scope', 'global')}
                  />
                  <span>Личная</span>
                </label>
                <label className="fm-radio">
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === 'workplace'}
                    onChange={() => setField('scope', 'workplace')}
                    disabled={!currentId}
                  />
                  <span>
                    Заведение {!currentId && <small>(нет текущего)</small>}
                  </span>
                </label>
                <label className="fm-radio">
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === 'shift'}
                    onChange={() => setField('scope', 'shift')}
                    disabled={!currentShift}
                  />
                  <span>
                    Смена {!currentShift && <small>(нет открытой)</small>}
                  </span>
                </label>
              </div>
            </fieldset>
          ) : (
            <div className="nf-scope-readonly">
              <span className={`note-scope note-scope--${initial.scope}`}>
                {scopeBadgeLabel(initial.scope)}
              </span>
              <small className="nf-scope-hint">
                Привязку нельзя изменить — создайте новую заметку при необходимости
              </small>
            </div>
          )}

          <div className="sheet-actions">
            {isEdit && (
              <button
                className="btn btn--ghost-danger"
                disabled={busy}
                onClick={onDelete}
              >
                Удалить
              </button>
            )}
            {isEdit && (
              <button className="btn btn--ghost" disabled={busy} onClick={onArchive}>
                {form.is_archived ? 'Из архива' : 'В архив'}
              </button>
            )}
            <div className="sheet-actions-spacer" />
            <button className="btn btn--ghost" onClick={() => onClose?.()}>
              Отмена
            </button>
            <button className="btn btn--primary" disabled={busy} onClick={onSubmit}>
              {busy ? '…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}