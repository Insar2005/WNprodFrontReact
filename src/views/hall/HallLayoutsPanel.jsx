import { useState } from 'react'
import { useHallStore } from '@/stores/hall'
import { useUiStore } from '@/stores/ui'
import { newId } from '@/utils/nanoid'
import { pluralize } from '@/utils/pluralize'
import WnSheet from '@/components/WnSheet'
import { PlusIcon, DotsIcon } from '@/components/menu/menuIcons'

/**
 * Шаблоны зала — 1:1 EdTemplatesSheet из прототипа (editor-ui.jsx) на
 * общем WnSheet: «Сохранить текущую расстановку как шаблон» → prompt
 * имени; ряды «Название / дата · N столов» + «Применить» + меню «…»
 * (Переименовать/Удалить).
 *
 * Логика прежняя (не регрессировать): createLayout, умное applyLayout
 * (confirm про «лишние» столы; занятые заказами не удаляются; тост-итог
 * «+N новых, M переставлены, −K»), renameLayout, removeLayout.
 */
const fmtDate = (ts) =>
  ts
    ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(
        new Date(ts * 1000),
      )
    : ''

export default function HallLayoutsPanel({ onClose, onApplied }) {
  const layouts = useHallStore((s) => s.layouts)
  const [busy, setBusy] = useState(false)
  const [menuFor, setMenuFor] = useState(null)

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

  return (
    <WnSheet title="Шаблоны зала" onClose={onClose}>
      <button type="button" className="ed2-tpl-save" disabled={busy} onClick={onSaveCurrent}>
        <PlusIcon width={17} height={17} /> Сохранить текущую расстановку как шаблон
      </button>

      <div className="ed2-tpl-list">
        {layouts.length === 0 && <div className="ed2-tpl-empty">Шаблонов пока нет</div>}
        {layouts.map((tpl) => (
          <div key={tpl.id} className="ed2-tpl-row">
            <div className="ed2-tpl-main">
              <div className="ed2-tpl-name">{tpl.name}</div>
              <div className="ed2-tpl-meta">
                {fmtDate(tpl.created_at)} · {(tpl.positions || []).length}{' '}
                {pluralize((tpl.positions || []).length, ['стол', 'стола', 'столов'])}
              </div>
            </div>
            <button type="button" className="ed2-tpl-apply" disabled={busy} onClick={() => onApply(tpl)}>
              Применить
            </button>
            <button
              type="button"
              className="ed2-tpl-dots"
              aria-label="Ещё"
              onClick={() => setMenuFor(menuFor === tpl.id ? null : tpl.id)}
            >
              <DotsIcon width={18} height={18} />
            </button>
            {menuFor === tpl.id && (
              <>
                <div className="ed2-tpl-backdrop" onClick={() => setMenuFor(null)} />
                <div className="ed2-tpl-menu">
                  <button
                    type="button"
                    className="ed2-tpl-menu-item"
                    onClick={() => {
                      setMenuFor(null)
                      onRename(tpl)
                    }}
                  >
                    Переименовать
                  </button>
                  <button
                    type="button"
                    className="ed2-tpl-menu-item ed2-tpl-menu-item--danger"
                    onClick={() => {
                      setMenuFor(null)
                      onDelete(tpl)
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </WnSheet>
  )
}