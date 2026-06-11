/**
 * One note card. (Was NoteCard.vue.)
 * - computed scopeLabel → plain function of note.scope.
 * - formatRelative kept verbatim (pure helper).
 * - $emit('edit', note) → onEdit(note).
 */

function scopeLabelFor(scope) {
  switch (scope) {
    case 'shift':
      return 'Смена'
    case 'workplace':
      return 'Заведение'
    case 'global':
      return 'Личное'
    default:
      return scope
  }
}

function formatRelative(unixSeconds) {
  if (!unixSeconds) return ''
  const now = Math.floor(Date.now() / 1000)
  const diff = now - unixSeconds
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} дн назад`
  const date = new Date(unixSeconds * 1000)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }).format(date)
}

export default function NoteCard({ note, onEdit }) {
  const cls = [
    'note-card',
    note.pinned ? 'note-card--pinned' : '',
    note.is_archived ? 'note-card--archived' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} onClick={() => onEdit?.(note)}>
      <div className="note-top">
        {note.pinned && <span className="note-pin">📌</span>}
        <h3 className="note-title">{note.header}</h3>
      </div>

      {note.content && <p className="note-content">{note.content}</p>}

      <div className="note-bottom">
        <span className={`note-scope note-scope--${note.scope}`}>
          {scopeLabelFor(note.scope)}
        </span>
        <span className="note-date">{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  )
}