import { Task, Prisma } from '@prisma/client'
import { Database } from './projectAccess'
import { AppError } from '../middlewares/errorHandler'
export const taskInclude = {
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } },
  project: { select: { id: true, name: true } },
} as const
export async function lockedTask(db: Database, taskId: number) {
  await db.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`
  const task = await db.task.findUnique({ where: { id: taskId }, include: taskInclude })
  if (!task) throw new AppError(404, 'Tarea no encontrada o sin acceso')
  return task
}
export function requireVersion(task: Task, expected: number) {
  if (task.version !== expected) throw new AppError(409, 'Esta tarea cambió mientras la estabas editando', {
    code: 'TASK_VERSION_CONFLICT', currentVersion: task.version, currentTask: task,
  })
}
export const fields = ['title', 'description', 'status', 'priority', 'assigneeId', 'dueDate'] as const
type Snapshot = Task & { assignee?: { id: number; name: string } | null }
function value(task: Snapshot | null, field: typeof fields[number]): Prisma.InputJsonValue | null {
  if (!task) return null
  if (field === 'dueDate') return task.dueDate?.toISOString() ?? null
  if (field === 'assigneeId') return task.assigneeId === null ? null : { id: task.assigneeId, name: task.assignee?.name ?? 'Usuario' }
  return task[field]
}
export async function recordTaskChange(db: Database, actorId: number, before: Snapshot | null, after: Snapshot,
  type = 'TASK_UPDATED', reason?: string) {
  const changes: Prisma.InputJsonObject = Object.fromEntries(fields
    .filter(field => !before || JSON.stringify(value(before, field)) !== JSON.stringify(value(after, field)))
    .map(field => [field, { before: value(before, field), after: value(after, field) }]))
  const [actor, project] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: actorId }, select: { name: true } }),
    db.project.findUniqueOrThrow({ where: { id: after.projectId }, select: { name: true } }),
  ])
  await db.activityLog.create({ data: {
    type, description: before ? `Actualizó la tarea "${after.title}"` : `Creó la tarea "${after.title}"`,
    userId: actorId, actorName: actor.name, projectId: after.projectId, taskId: after.id,
    taskTitle: after.title, taskStatus: after.status, taskPriority: after.priority, projectName: project.name,
    previousVersion: before?.version ?? null, resultingVersion: after.version, changes, reason,
  } })
}
// Orden ascendente de tareas para retiradas/borrado de cuenta; misma transacción que membresía.
export async function unassignTasks(db: Database, assigneeId: number, actorId: number, reason: string, projectId?: number) {
  const tasks = await db.task.findMany({ where: { assigneeId, ...(projectId !== undefined && { projectId }) }, orderBy: { id: 'asc' } })
  for (const item of tasks) {
    const before = await lockedTask(db, item.id)
    if (before.assigneeId !== assigneeId) continue
    const after = await db.task.update({ where: { id: item.id, version: before.version },
      data: { assigneeId: null, assignmentVersion: before.version + 1, version: { increment: 1 } }, include: taskInclude })
    await recordTaskChange(db, actorId, before, after, 'TASK_UNASSIGNED', reason)
  }
}
