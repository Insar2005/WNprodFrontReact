import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotesStore } from '@/stores/notes'
import { useWorkplaceStore } from '@/stores/workplace'
import { useShiftStore } from '@/stores/shift'
import WorkplaceSwitcher from '@/components/WorkplaceSwitcher'
import NoteCard from './NoteCard'
import NoteFormModal from './NoteFormModal'
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton'

/**
 * Notes screen. (Was Notes.vue.)
 * - All the computed filters (availableTabs, visibleNotes) → useMemo over
 *   raw `items` + the local filter state (search/tab/archived).
 * - search/tab/archived/formVisible/editingNote → useState.
 */

const sortNotes = (arr) =>
  [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updated_at - a.updated_at
  })

export default function Notes() {
  const navigate = useNavigate()
  useTelegramBackButton(() => {
    navigate('/tools')
  })
  const items = useNotesStore((s) => s.items)
  const isLoading = useNotesStore((s) => s.isLoading)
  const currentId = useWorkplaceStore((s) => s.currentId)
  const currentShift = useShiftStore((s) => s.current)

  const [searchQuery, setSearchQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [formVisible, setFormVisible] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  // Derived base lists (mirror the notes-store getters, but local so they
  // stay reactive to `items`).
  const sorted = useMemo(() => sortNotes(items), [items])
  const active = useMemo(() => sorted.filter((n) => !n.is_archived), [sorted])
  const archived = useMemo(() => sorted.filter((n) => n.is_archived), [sorted])
  const totalCount = active.length

  const availableTabs = useMemo(() => {
    const tabs = [{ key: 'all', label: 'Все', count: active.length }]
    if (currentId) {
      tabs.push({
        key: 'workplace',
        label: 'Заведение',
        count: active.filter((n) => n.workplace_id === currentId).length,
      })
    }
    if (currentShift) {
      tabs.push({
        key: 'shift',
        label: 'Смена',
        count: active.filter((n) => n.shift_id === currentShift.id).length,
      })
    }
    tabs.push({
      key: 'global',
      label: 'Личное',
      count: active.filter((n) => n.scope === 'global').length,
    })
    return tabs
  }, [active, currentId, currentShift])

  const visibleNotes = useMemo(() => {
    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return []
      return (showArchived ? sorted : active).filter(
        (n) =>
          n.header.toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q),
      )
    }
    if (showArchived) return archived
    switch (activeTab) {
      case 'workplace':
        return currentId ? active.filter((n) => n.workplace_id === currentId) : []
      case 'shift':
        return currentShift
          ? active.filter((n) => n.shift_id === currentShift.id)
          : []
      case 'global':
        return active.filter((n) => n.scope === 'global')
      default:
        return active
    }
  }, [searchQuery, showArchived, activeTab, sorted, active, archived, currentId, currentShift])

  const defaultScopeForCreate = useMemo(() => {
    if (activeTab === 'shift' && currentShift) return 'shift'
    if (activeTab === 'workplace' && currentId) return 'workplace'
    return 'global'
  }, [activeTab, currentShift, currentId])

  const openCreate = () => {
    setEditingNote(null)
    setFormVisible(true)
  }
  const openEdit = (note) => {
    setEditingNote(note)
    setFormVisible(true)
  }
  const closeForm = () => {
    setFormVisible(false)
    setEditingNote(null)
  }

  return (
    <div className="page notes-page">
      <header className="notes-header">
        <div className="notes-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* <button
              className="back-btn"
              onClick={() => navigate('/tools')}
              aria-label="Назад"
              style={{ paddingLeft: 0 }}
            >
              <svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button> */}
            <h1 className="notes-title">Заметки</h1>
          </div>
          {archived.length > 0 && (
            <label className="archive-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              <span>Архив ({archived.length})</span>
            </label>
          )}
        </div>
        <WorkplaceSwitcher />
      </header>

      <div className="search-wrap">
        <input
          type="search"
          className="search-input"
          placeholder="Поиск по заметкам…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>

      {!searchQuery && (
        <div className="tabs">
          {availableTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'tab tab--active' : 'tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : visibleNotes.length === 0 ? (
        <div className="notes-empty">
          <p className="empty-text">
            {searchQuery
              ? 'Ничего не найдено'
              : showArchived && archived.length === 0
                ? 'В архиве пусто'
                : totalCount === 0
                  ? 'Пока нет заметок'
                  : 'В этой вкладке пусто'}
          </p>
          {totalCount === 0 && !searchQuery && (
            <button className="btn-primary" onClick={openCreate}>
              Создать первую
            </button>
          )}
        </div>
      ) : (
        <div className="list">
          {visibleNotes.map((note) => (
            <NoteCard key={note.id} note={note} onEdit={openEdit} />
          ))}
        </div>
      )}

      {!showArchived && (
        <button className="fab" onClick={openCreate} aria-label="Новая заметка">
          +
        </button>
      )}

      {formVisible && (
        <NoteFormModal
          initial={editingNote}
          defaultScope={defaultScopeForCreate}
          onClose={closeForm}
          onSaved={closeForm}
        />
      )}
    </div>
  )
}
