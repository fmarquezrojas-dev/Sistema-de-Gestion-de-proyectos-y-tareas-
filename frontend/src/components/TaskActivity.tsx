import { useEffect, useState } from 'react'
import api from '../services/api'
import { errorMessage } from '../services/errors'
import { displayValue, fieldLabels } from '../services/taskState'
interface Activity {
  id: number; description: string; createdAt: string; actorName: string | null
  user: { id: number; name: string }; previousVersion: number | null; resultingVersion: number | null
  reason: string | null; changes: Record<string, { before: unknown; after: unknown }> | null
}
export default function TaskActivity({ taskId, version }: { taskId: number; version: number }) {
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<Activity[]>([])
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const response = await api.get<{ data: Activity[]; pagination: { totalPages: number } }>(`/tasks/${taskId}/activity?page=${page}&limit=10`)
        if (active) { setData(response.data.data); setPages(response.data.pagination.totalPages) }
      } catch (err) { if (active) setError(errorMessage(err, 'No se pudo cargar la actividad')) }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [taskId, version, page, attempt])
  return <section aria-label="Actividad de la tarea">
    <h4>Actividad</h4>
    {loading ? <p role="status">Cargando actividad...</p> : error ? <div role="alert">{error}<button onClick={() => setAttempt(n => n + 1)}>Reintentar actividad</button></div>
      : data.length === 0 ? <p>Sin actividad registrada</p> : <ol>
        {data.map(event => <li key={event.id}>
          <strong>{event.actorName || event.user.name}</strong> · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('es-PE')}</time>
          {event.resultingVersion !== null && <span> · Versión {event.previousVersion ?? 0} → {event.resultingVersion}</span>}
          {event.reason === 'MEMBER_REMOVED' && <p>Desasignación por retirada de miembro</p>}
          {event.changes ? <ul>{Object.entries(event.changes).map(([field, change]) => <li key={field}>
            {fieldLabels[field] || field}: <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue(change.before, field)}</span> → <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue(change.after, field)}</span>
          </li>)}</ul> : <p>Evento antiguo: {event.description}</p>}
        </li>)}
      </ol>}
    <button disabled={loading || page <= 1} onClick={() => setPage(n => n - 1)}>Actividad anterior</button>
    <span> Página {page} de {Math.max(1, pages)} </span>
    <button disabled={loading || page >= pages} onClick={() => setPage(n => n + 1)}>Actividad siguiente</button>
  </section>
}
