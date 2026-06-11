import { useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import BottomSheet from '@/components/BottomSheet'

function pluralize(n, forms) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}
function formatDate(ts) {
  if (!ts) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(
    new Date(ts * 1000),
  )
}

/**
 * Saved table arrangements (templates). (Was HallLayoutsPanel.vue.)
 * Built on the React BottomSheet (header + children props).
 * $emit('close'|'applied') → onClose / onApplied.
 */
export default function HallLayoutsPanel({ visible = false, onClose, onApplied }) {
  const layouts = useHallStore((s) => s.layouts)
  const [busy, setBusy] = useState(false)

  const onSaveCurrent = async () => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    if (!hall.activeHallId) return
    const name = await ui.prompt({
      title: 'Название шаблона',
      placeholder: 'Например: Стандарт, Банкет, Вечер',
      confirmText: 'Сохранить',
      required: true,
      maxLength: 60,
    })
    if (!name) return
    setBusy(true)
    try {
      await hall.createLayout(hall.activeHallId, { id: newId(), name: name.trim() })
      ui.toastSuccess(`Шаблон «${name.trim()}» сохранён`)
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onApply = async (layout) => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    const layoutNumbers = new Set((layout.positions || []).map((p) => p.table_number))
    const currentExtras = hall
      .tablesOfHall(hall.activeHallId)
      .filter((t) => !layoutNumbers.has(t.number))

    let deleteExtras = false
    if (currentExtras.length > 0) {
      const ok = await ui.confirm({
        title: `В зале есть «лишние» столы (${currentExtras.length})`,
        message:
          `Столы ${currentExtras.map((t) => '№' + t.number).join(', ')} не входят в шаблон. ` +
          'Удалить их? Столы с активными заказами не будут удалены.',
        confirmText: 'Удалить',
        cancelText: 'Оставить',
        danger: true,
      })
      deleteExtras = !!ok
    }

    setBusy(true)
    try {
      const result = await hall.applyLayout(layout.id, {
        delete_extras: deleteExtras,
        new_table_ids: Object.fromEntries(
          (layout.positions || [])
            .filter(
              (p) =>
                !hall
                  .tablesOfHall(hall.activeHallId)
                  .some((t) => t.number === p.table_number),
            )
            .map((p) => [p.table_number, newId()]),
        ),
      })
      const msgs = []
      if (result.created.length > 0) msgs.push(`+${result.created.length} новых`)
      if (result.moved.length > 0) msgs.push(`${result.moved.length} переставлены`)
      if (result.deleted_extras.length > 0)
        msgs.push(`-${result.deleted_extras.length} удалены`)
      if (result.kept_extras.length > 0) {
        const blockedNums = result.kept_extras.map((e) => `№${e.number}`).join(', ')
        ui.toastWarning(
          `Шаблон применён, но столы ${blockedNums} не удалены — на них активные заказы`,
        )
      } else {
        ui.toastSuccess(
          `Шаблон «${layout.name}» применён · ${msgs.join(', ') || 'без изменений'}`,
        )
      }
      onApplied?.({ layoutId: layout.id, ...result })
      onClose?.()
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onRename = async (layout) => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    const name = await ui.prompt({
      title: 'Новое название',
      initial: layout.name,
      confirmText: 'Сохранить',
      required: true,
      maxLength: 60,
    })
    if (!name || name.trim() === layout.name) return
    setBusy(true)
    try {
      await hall.renameLayout(layout.id, name.trim())
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onDelete = async (layout) => {
    const hall = useHallStore.getState()
    const ui = useUiStore.getState()
    const ok = await ui.confirm({
      title: `Удалить шаблон «${layout.name}»?`,
      message: 'Расстановка столов в зале не изменится.',
      confirmText: 'Удалить',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await hall.removeLayout(layout.id)
      ui.toastSuccess('Шаблон удалён')
    } catch (e) {
      ui.toastError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <div className="hlp-header">
      <h2 className="hlp-title">Шаблоны расстановки</h2>
      <button className="hlp-close" onClick={() => onClose?.()} aria-label="Закрыть">
        ×
      </button>
    </div>
  )

  return (
    <BottomSheet
      visible={visible}
      snapPoints={[280, 0.55]}
      initialSnap={0}
      header={header}
      onClose={onClose}
    >
      <div className="hlp-body">
        <button
          className="hlp-action hlp-action--save"
          disabled={busy}
          onClick={onSaveCurrent}
        >
          💾 Сохранить текущую расстановку
        </button>

        {layouts.length === 0 ? (
          <p className="hlp-empty">
            Сохранённых шаблонов нет. Расставьте столы как нужно и сохраните —
            потом можно будет вернуть в один тап.
          </p>
        ) : (
          <ul className="hlp-list">
            {layouts.map((l) => (
              <li key={l.id} className="hlp-item">
                <div className="hlp-info">
                  <div className="hlp-name">{l.name}</div>
                  <div className="hlp-meta">
                    {l.positions?.length || 0}{' '}
                    {pluralize(l.positions?.length || 0, ['стол', 'стола', 'столов'])} ·
                    сохранён {formatDate(l.created_at)}
                  </div>
                </div>
                <div className="hlp-actions">
                  <button className="hlp-apply" disabled={busy} onClick={() => onApply(l)}>
                    Применить
                  </button>
                  <button
                    className="hlp-icon"
                    disabled={busy}
                    aria-label="Переименовать"
                    onClick={() => onRename(l)}
                  >
                    ✏️
                  </button>
                  <button
                    className="hlp-icon hlp-icon--danger"
                    disabled={busy}
                    aria-label="Удалить"
                    onClick={() => onDelete(l)}
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  )
}