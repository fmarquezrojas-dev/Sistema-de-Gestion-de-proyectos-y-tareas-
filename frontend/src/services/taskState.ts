import { isAxiosError } from 'axios'
import type { Task } from '../types'
export function conflictTask(error: unknown): Task | null {
  if (!isAxiosError<{ code?: string; currentTask?: Task }>(error)) return null
  return error.response?.status === 409 && error.response.data.code === 'TASK_VERSION_CONFLICT'
    ? error.response.data.currentTask ?? null : null
}
export function mergeTask(current: Task, incoming: Task): Task {
  return incoming.version < current.version ? current : { ...current, ...incoming }
}
export function mergeTasks(current: Task[], incoming: Task[]): Task[] {
  return incoming.map(task => {
    const previous = current.find(t => t.id === task.id)
    return previous ? mergeTask(previous, task) : task
  })
}
export const fieldLabels: Record<string, string> = {
  title: 'Título', description: 'Descripción', priority: 'Prioridad', status: 'Estado',
  assigneeId: 'Responsable', dueDate: 'Vencimiento',
}
const labels: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada', LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' }
export function displayValue(value: unknown, field?: string): string {
  if (value === null || value === undefined || value === '') return 'Sin valor'
  if (typeof value === 'object' && 'name' in value) return String(value.name)
  if (field === 'dueDate' && typeof value === 'string') return new Date(value).toLocaleString('es-PE')
  return labels[String(value)] || String(value)
}
