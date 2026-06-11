import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkplaceStore } from '@/stores/workplace'
import { useUiStore } from '@/stores/ui'
import { formatMoney } from '@/utils/format'
import WorkplaceFormModal from '@/components/WorkplaceFormModal'

function shiftTypeLabel(t) {
  return t === 'fixed' ? 'фикс' : 'процент'
}

/**
 * All workplaces: active list (tap to switch, ✏️ to edit) + archive section.
 * (Was WorkplacesView.vue.) Reuses WorkplaceFormModal for create/edit.
 * activeList/archivedList derived via useMemo on raw items.
 */
export default function WorkplacesView() {
  const navigate = useNavigate()

  const items = useWorkplaceStore((s) => s.items)
  const currentId = useWorkplaceStore((s) => s.currentId)

  const [formVisible, setFormVisible] = useState(false)
  const [editingWorkplace, setEditingWorkplace] = useState(null)

  const activeList = useMemo(
    () =>
      [...items]
        .filter((w) => !w.is_archived)
        .sort((a, b) => a.position - b.position),
    [items],
  )
  const archivedList = useMemo(
    () => items.filter((w) => w.is_archived),
    [items],
  )
  const isEmpty = items.length === 0

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/profile')
  }

  const selectWorkplace = async (id) => {
    if (id === currentId) return
    try {
      await useWorkplaceStore.getState().setCurrent(id)
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось переключить заведение')
    }
  }

  const openCreateForm = () => {
    setEditingWorkplace(null)
    setFormVisible(true)
  }
  const openEditForm = (w) => {
    setEditingWorkplace(w)
    setFormVisible(true)
  }
  const closeForm = () => {
    setFormVisible(false)
    setEditingWorkplace(null)
  }

  const unarchiveWorkplace = async (id) => {
    try {
      await useWorkplaceStore.getState().unarchive(id)
      useUiStore.getState().toastSuccess('Заведение восстановлено')
    } catch (e) {
      useUiStore.getState().toastError(e.message || 'Не удалось восстановить')
    }
  }

  return (
    <div className="page">
      <header className="sub-header">
        <button className="back-btn" onClick={goBack} aria-label="Назад">
          ←
        </button>
        <h1 className="sub-title">Заведения</h1>
        <button className="btn-add" onClick={openCreateForm}>
          + Добавить
        </button>
      </header>

      {isEmpty ? (
        <div className="wv-empty">
          <p className="empty-text">У вас пока нет ни одного заведения.</p>
          <button className="btn-primary" onClick={openCreateForm}>
            Создать первое
          </button>
        </div>
      ) : (
        <div>
          <section className="pf-section">
            <div className="wv-list">
              {activeList.map((w) => (
                <div
                  key={w.id}
                  className={
                    w.id === currentId ? 'card card--current' : 'card'
                  }
                  onClick={() => selectWorkplace(w.id)}
                >
                  <div className="card-main">
                    <div className="card-title-row">
                      <span className="card-title">{w.title}</span>
                      {w.id === currentId && (
                        <span className="card-badge">текущее</span>
                      )}
                      {w.my_role !== 'owner' && (
                        <span className="card-badge card-badge--muted">
                          участник
                        </span>
                      )}
                    </div>
                    <div className="card-meta">
                      {w.currency} · {shiftTypeLabel(w.shift_type_default)}
                      {w.shift_type_default === 'fixed'
                        ? ` · ${formatMoney(w.pay_for_shift_default, w.currency)}/смена`
                        : ` · ${w.service_percent_default}%`}
                    </div>
                  </div>
                  {w.my_role === 'owner' && (
                    <button
                      className="card-action"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditForm(w)
                      }}
                      aria-label="Редактировать"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {archivedList.length > 0 && (
            <section className="pf-section">
              <h2 className="pf-section-title">Архив</h2>
              <div className="wv-list">
                {archivedList.map((w) => (
                  <div key={w.id} className="card card--archived">
                    <div className="card-main">
                      <div className="card-title-row">
                        <span className="card-title">{w.title}</span>
                      </div>
                    </div>
                    {w.my_role === 'owner' && (
                      <button
                        className="card-action"
                        onClick={() => unarchiveWorkplace(w.id)}
                        aria-label="Восстановить"
                      >
                        ↻
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {formVisible && (
        <WorkplaceFormModal
          initial={editingWorkplace}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}