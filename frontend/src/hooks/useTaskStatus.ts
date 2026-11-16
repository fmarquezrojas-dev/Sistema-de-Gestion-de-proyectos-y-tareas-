import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Task } from '../types'
import api from '../services/api'
import { errorMessage, errorStatus } from '../services/errors'
import { conflictTask, mergeTask } from '../services/taskState'

export function useTaskStatus(tasks: Task[], setTasks: Dispatch<SetStateAction<Task[]>>) {
  const revision = useRef(0)
  const pending = useRef(new Set<number>())
  const readRevision = useCallback(() => revision.current, [])
  const hasPending = useCallback(() => pending.current.size > 0, [])
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [mutationError, setMutationError] = useState<string | null>(null)
  const apply = (task: Task) => setTasks(current => current.map(t => t.id === task.id ? { ...mergeTask(t, task), saving: false, uncertain: false } : t))
  const checkTask = async (taskId: number) => {
    if (pending.current.has(taskId)) return
    pending.current.add(taskId); setPendingIds(new Set(pending.current)); revision.current++
    try {
      const res = await api.get<{ data: Task }>(`/tasks/${taskId}`)
      apply(res.data.data)
      setMutationError(null)
    } catch (error) {
      if (errorStatus(error) === 404) setTasks(current => current.filter(t => t.id !== taskId))
      setMutationError(errorMessage(error, 'El resultado no está confirmado. Vuelve a comprobar la tarea'))
    } finally { pending.current.delete(taskId); setPendingIds(new Set(pending.current)); revision.current++ }
  }
  const changeStatus = async (taskId: number, status: Task['status']) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task?.canEdit || task.uncertain || task.saving || pending.current.has(taskId) || task.status === status) return
    revision.current++
    pending.current.add(taskId); setPendingIds(new Set(pending.current))
    setMutationError(null)
    setTasks(current => current.map(t => t.id === taskId ? { ...t, status, saving: true } : t))
    try {
      const res = await api.patch<{ data: Task }>(`/tasks/${taskId}/status`, { status, expectedVersion: task.version })
      apply(res.data.data)
    } catch (error) {
      const currentTask = conflictTask(error)
      const code = errorStatus(error)
      if (currentTask) {
        apply(currentTask)
        setMutationError('Esta tarea cambió mientras la estabas editando. Se muestra la versión actual')
      } else if (code === 404) {
        setTasks(current => current.filter(t => t.id !== taskId))
        setMutationError('La tarea fue eliminada o ya no tienes acceso')
      } else if (code === 403 || code === 400 || code === 401) {
        setTasks(current => current.map(t => t.id === taskId && t.version === task.version
          ? { ...t, status: task.status, saving: false, ...(code === 403 && { canEdit: false }) } : t))
        setMutationError(errorMessage(error))
      } else {
        // La escritura puede haberse confirmado aunque su respuesta no llegara.
        setTasks(current => current.map(t => t.id === taskId ? { ...t, saving: false, uncertain: true } : t))
        try {
          const res = await api.get<{ data: Task }>(`/tasks/${taskId}`)
          apply(res.data.data)
          setMutationError('La respuesta del guardado no llegó. Se consultó el estado actual; revisa la tarea')
        } catch (readError) {
          if (errorStatus(readError) === 404) setTasks(current => current.filter(t => t.id !== taskId))
          setMutationError('El resultado no está confirmado. Vuelve a comprobar la tarea antes de modificarla')
        }
      }
    } finally {
      revision.current++; pending.current.delete(taskId); setPendingIds(new Set(pending.current))
    }
  }
  return { readRevision, hasPending, changeStatus, checkTask, mutationError, pendingIds, pending, revision }
}
