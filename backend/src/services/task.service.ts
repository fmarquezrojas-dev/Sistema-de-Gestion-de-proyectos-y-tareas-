import prisma from '../utils/prismaClient'
import { Prisma } from '@prisma/client'
import { lockedTask, requireVersion, recordTaskChange, taskInclude, fields } from './taskHistory'
import { enqueueAssignment } from './notification.service'
import { requireMember, requireOwner, requireTaskPermission, requireTask, requireAssignee, transaction } from './projectAccess'
import { TaskInput, TaskFilters, TaskUpdateInput } from '../middlewares/resourceValidation'
const assignee = { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } } as const
export const getTasksByProject = async (projectId: number, userId: number, filters: TaskFilters) => {
  await requireMember(prisma, projectId, userId)
  const { page, limit, status, priority, search } = filters
  const where: Prisma.TaskWhereInput = { projectId, status, priority,
    project: { members: { some: { userId } } },
    ...(search && { title: { contains: search, mode: 'insensitive' } }) }
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, include: { assignee }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.task.count({ where }),
  ])
  return { data: tasks, total, page, limit }
}
export const getTaskById = (taskId: number, userId: number) => transaction(async db => {
  const { member } = await requireTask(db, taskId, userId)
  const task = await db.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude })
  return { ...task, canEdit: member.role === 'OWNER' || member.canEditTasks, canModerateComments: member.role === 'OWNER' }
})
export const createTask = async (projectId: number, userId: number, body: TaskInput) => {
  const result = await transaction(async db => {
    const member = await requireMember(db, projectId, userId)
    requireTaskPermission(member, 'canCreateTasks')
    await requireAssignee(db, projectId, body.assigneeId)
    const project = await db.project.findUniqueOrThrow({ where: { id: projectId } })
    const task = await db.task.create({ data: { ...body, projectId, assignmentVersion: body.assigneeId ? 1 : 0, dueDate: body.dueDate ? new Date(body.dueDate) : null }, include: taskInclude })
    await recordTaskChange(db, userId, null, task, 'TASK_CREATED')
    await enqueueAssignment(db, task, userId)
    return { task, project }
  })
  return result.task
}
export const updateTask = async (taskId: number, userId: number, body: TaskUpdateInput) => {
  const result = await transaction(async db => {
    const { member } = await requireTask(db, taskId, userId)
    requireTaskPermission(member, 'canEditTasks')
    const before = await lockedTask(db, taskId)
    requireVersion(before, body.expectedVersion)
    await requireAssignee(db, before.projectId, body.assigneeId)
    const { expectedVersion, ...input } = body
    const data = { ...input, dueDate: input.dueDate === undefined ? undefined : input.dueDate === null ? null : new Date(input.dueDate) }
    const changed = fields.some(field => data[field] !== undefined &&
      JSON.stringify(data[field]) !== JSON.stringify(before[field]))
    if (!changed) return { before, updated: before }
    const updated = await db.task.update({ where: { id: taskId, version: expectedVersion },
      data: { ...data, ...(input.assigneeId !== undefined && input.assigneeId !== before.assigneeId && { assignmentVersion: before.version + 1 }), version: { increment: 1 } }, include: taskInclude })
    await recordTaskChange(db, userId, before, updated, updated.status === 'COMPLETED' && before.status !== 'COMPLETED' ? 'TASK_COMPLETED' : 'TASK_UPDATED')
    if (before.assigneeId !== updated.assigneeId) await enqueueAssignment(db, updated, userId)
    return { before, updated }
  })
  return result.updated
}
export const deleteTask = (taskId: number, userId: number, expectedVersion: number) => transaction(async db => {
  const { member } = await requireTask(db, taskId, userId)
  requireOwner(member)
  const task = await lockedTask(db, taskId)
  requireVersion(task, expectedVersion)
  // Se conserva la política de cascada existente: borrar tarea borra su historial.
  await db.task.delete({ where: { id: taskId, version: expectedVersion } })
})
export const getTaskHistory = (taskId: number, userId: number, page: number, limit: number) => transaction(async db => {
  await requireTask(db, taskId, userId)
  const where = { taskId }
  const [data, total] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
      select: { id: true, type: true, description: true, createdAt: true, previousVersion: true, resultingVersion: true,
        changes: true, reason: true, actorName: true, user: { select: { id: true, name: true } } } }),
    db.activityLog.count({ where }),
  ])
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
})
export const getMyTasks = async (userId: number, filters: TaskFilters) => {
  const { page, limit, status, priority, search } = filters
  const where: Prisma.TaskWhereInput = { assigneeId: userId, project: { members: { some: { userId } } }, status, priority,
    ...(search && { title: { contains: search, mode: 'insensitive' } }) }
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { id: 'desc' }],
      include: { assignee, project: { select: { id: true, name: true, members: { where: { userId }, select: { role: true, canEditTasks: true } } } } } }),
    prisma.task.count({ where }),
  ])
  return {
    data: tasks.map(({ project, ...task }) => ({ ...task, project: { id: project.id, name: project.name },
      canEdit: project.members[0]?.role === 'OWNER' || project.members[0]?.canEditTasks === true,
      canModerateComments: project.members[0]?.role === 'OWNER' })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
  }
}
