import { errorMessage, errorStatus } from '../services/errors'
/**
 * frontend/src/components/TaskComments.tsx
 *
 * Sección de comentarios para una tarea específica.
 * Se embebe en ProjectDetail.tsx dentro de cada task card al expandirla.
 *
 * Uso:
 *   <TaskComments taskId={task.id} currentUser={user} />
 *
 * Requiere backend:
 *   GET  /tasks/:taskId/comments
 *   POST /tasks/:taskId/comments   { content: string }
 *   DELETE /tasks/:taskId/comments/:commentId
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../services/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Comment {
  id:        number
  content:   string
  createdAt: string
  user: {
    id:          number
    name:        string
    avatarColor: string
    avatarUrl:   string | null
  }
}

interface TaskCommentsProps {
  taskId:      number
  currentUser: { id: number; name: string } | null
  canModerate?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)    return 'Ahora mismo'
  if (mins < 60)   return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24)  return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1)  return 'Ayer'
  if (days < 7)    return `Hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

// ─── Avatar inline ────────────────────────────────────────────────────────────
const CommentAvatar = ({ user, size = 32 }: {
  user: Comment['user']; size?: number
}) => {
  const [err, setErr] = useState(false)
  if (user.avatarUrl && !err)
    return (
      <img src={user.avatarUrl} alt={user.name} onError={() => setErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    )
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: user.avatarColor || '#4f46e5', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
    }}>
      {user.name?.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
const TaskComments = ({ taskId, currentUser, canModerate = false }: TaskCommentsProps) => {
  const [accessible, setAccessible] = useState(true)
  const [comments,  setComments]  = useState<Comment[]>([])
  const [loading,   setLoading]   = useState(true)
  const [content,   setContent]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listEndRef  = useRef<HTMLDivElement>(null)

  const fetchComments = useCallback(() => api.get(`/tasks/${taskId}/comments`).then(res => {
    const rawData = res.data?.data ?? res.data?.comments ?? res.data
    setAccessible(true); setError(null)
    setComments(Array.isArray(rawData) ? rawData : [])
  }).catch((err: unknown) => {
    if (errorStatus(err) === 404) { setComments([]); setAccessible(false) }
    setError(errorMessage(err, 'Error al cargar comentarios'))
  }).finally(() => setLoading(false)), [taskId])

  useEffect(() => { void fetchComments() }, [fetchComments])

  // Auto-scroll al añadir comentario
  useEffect(() => {
    if (comments.length > 0)
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [comments.length])

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || !accessible || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await api.post(`/tasks/${taskId}/comments`, { content: trimmed })
      // El backend puede devolver { data: comment } o { comment } o el objeto directo
      const newComment = res.data?.data ?? res.data?.comment ?? res.data
      if (!newComment || typeof newComment !== 'object' || !newComment.id) {
        // Refetch en lugar de optimistic update si la respuesta es inesperada
        await fetchComments()
      } else {
        setComments(prev => [...prev, newComment])
      }
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      if (errorStatus(err) === 404) { setComments([]); setAccessible(false) }
      setError(errorMessage(err, 'No se pudo añadir el comentario'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: number) => {
    setDeletingId(commentId)
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      if (errorStatus(err) === 404) { setComments([]); setAccessible(false) }
      setError(errorMessage(err, 'Error al eliminar comentario'))
    } finally {
      setDeletingId(null)
    }
  }

  // Ctrl+Enter para enviar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void handleSubmit(e)
    }
  }

  // Auto-resize del textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  return (
    <div style={{
      marginTop:    '0.75rem',
      borderTop:    '1px solid var(--border-color)',
      paddingTop:   '0.85rem',
    }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          💬 Comentarios
        </span>
        {comments.length > 0 && (
          <span style={{ fontSize: '0.7rem', background: '#6366f1', color: '#fff',
            padding: '0.05rem 0.5rem', borderRadius: '999px', fontWeight: 700 }}>
            {comments.length}
          </span>
        )}
      </div>

      {/* Lista de comentarios */}
      {loading ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem' }}>
          Cargando comentarios...
        </p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem', fontStyle: 'italic' }}>
          Sé el primero en comentar...
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.85rem', maxHeight: '260px', overflowY: 'auto' }}>
          {comments.map(comment => {
            const isOwn = comment.user.id === currentUser?.id || canModerate
            return (
              <div key={comment.id} style={{
                display:     'flex',
                gap:         '0.65rem',
                alignItems:  'flex-start',
                padding:     '0.65rem 0.75rem',
                borderRadius:'8px',
                background:  isOwn ? 'rgba(99,102,241,0.1)' : 'var(--bg-subtle)',
                border:      `1px solid ${isOwn ? '#818cf8' : 'var(--border-color)'}`,
                position:    'relative',
              }}>
                <CommentAvatar user={comment.user} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {comment.user.name}
                      {isOwn && <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '0.68rem', marginLeft: '0.3rem' }}>(tú)</span>}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: '0.83rem', color: 'var(--text-primary)',
                    lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {comment.content}
                  </p>
                </div>
                {isOwn && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    title="Eliminar comentario"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#cbd5e1', fontSize: '0.75rem', padding: '0.1rem',
                      flexShrink: 0, opacity: 0.6,
                      transition: 'color 0.15s, opacity 0.15s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#ef4444'; (e.target as HTMLButtonElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#cbd5e1'; (e.target as HTMLButtonElement).style.opacity = '0.6' }}
                  >
                    {deletingId === comment.id ? '...' : '✕'}
                  </button>
                )}
              </div>
            )
          })}
          <div ref={listEndRef} />
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ fontSize: '0.78rem', color: '#ef4444', margin: '0 0 0.5rem', padding: '0 0.25rem' }}>
          ⚠️ {error}
        </p>
      )}

      {/* Formulario nuevo comentario */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        {currentUser && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: '#4f46e5', color: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700,
          }}>
            {currentUser.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            maxLength={5000}
            disabled={!accessible}
            value={content}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comentario... (Ctrl+Enter para enviar)"
            style={{
              width:       '100%',
              minHeight:   '36px',
              maxHeight:   '120px',
              padding:     '0.5rem 0.75rem',
              border:      '1px solid var(--border-color)',
              borderRadius:'8px',
              fontSize:    '0.83rem',
              fontFamily:  'inherit',
              resize:      'none',
              outline:     'none',
              boxSizing:   'border-box',
              lineHeight:  1.5,
              transition:  'border-color 0.15s',
              background:  'var(--input-bg)',
            }}
            onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.background = 'var(--bg-card)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.background = 'var(--input-bg)' }}
          />
        </div>
        <button
          type="submit"
          disabled={!accessible || submitting || !content.trim()}
          style={{
            background:    content.trim() ? '#4f46e5' : 'var(--border-color)',
            color:         content.trim() ? '#fff' : 'var(--text-muted)',
            border:        'none',
            borderRadius:  '8px',
            padding:       '0.5rem 0.85rem',
            cursor:        content.trim() ? 'pointer' : 'not-allowed',
            fontSize:      '0.82rem',
            fontWeight:    700,
            flexShrink:    0,
            transition:    'background 0.15s, color 0.15s',
            height:        '36px',
            display:       'flex',
            alignItems:    'center',
            gap:           '0.3rem',
          }}
        >
          {submitting ? (
            <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
          ) : '↑'}
          {submitting ? '' : 'Enviar'}
        </button>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default TaskComments
