import { randomUUID } from 'crypto'
import { Task, NotificationJob } from '@prisma/client'
import prisma from '../utils/prismaClient'
import { Database } from './projectAccess'
import { AppError } from '../middlewares/errorHandler'

export const MAX_ATTEMPTS = 5
export const LEASE_MS = 120000
export async function enqueueAssignment(db: Database, task: Task, actorId: number) {
  if (!task.assigneeId || task.assigneeId === actorId || task.status === 'COMPLETED') return
  await db.notificationJob.create({ data: {
    kind: 'assigned', taskId: task.id, projectId: task.projectId, recipientId: task.assigneeId,
    nextAttemptAt: new Date(), assignmentVersion: task.assignmentVersion, dedupeKey: `assigned:${task.id}:${task.assignmentVersion}`,
  } })
}
export async function planReminders(afterId: number, now = new Date()) {
  // Keyset scan acotado: cada ciclo continúa desde el cursor, incluso sin candidatos.
  const tasks = await prisma.task.findMany({ where: { id: { gt: afterId } }, orderBy: { id: 'asc' }, take: 100,
    include: { project: { select: { status: true, members: { select: { userId: true } } } } } })
  const jobs = tasks.flatMap(task => {
    if (!task.assigneeId || !task.dueDate || task.status === 'COMPLETED' || task.project.status !== 'ACTIVE' ||
      !task.project.members.some(m => m.userId === task.assigneeId)) return []
    const delta = task.dueDate.getTime() - now.getTime()
    if (delta > 86400000) return []
    const kind = delta > 0 ? 'due_soon' : 'overdue'
    return [{ nextAttemptAt: now, kind, taskId: task.id, projectId: task.projectId, recipientId: task.assigneeId,
      dueDate: task.dueDate, dedupeKey: `${kind}:${task.id}:${task.assigneeId}:${task.dueDate.toISOString()}` }]
  })
  await prisma.notificationJob.createMany({ data: jobs, skipDuplicates: true })
  return { nextCursor: tasks.length === 100 ? tasks[tasks.length - 1].id : 0 }
}
export async function claimJobs(limit: number, now = new Date()) {
  return prisma.$transaction(async db => {
    await db.notificationJob.updateMany({ where: { status: 'processing', leaseUntil: { lte: now } },
      data: { status: 'unknown', diagnostic: 'LEASE_EXPIRED' } })
    const rows = await db.$queryRaw<{ id: string }[]>`SELECT id FROM notification_jobs
      WHERE status = 'pending' AND "nextAttemptAt" <= ${now.toISOString()}::timestamp AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "nextAttemptAt", id FOR UPDATE SKIP LOCKED LIMIT ${limit}`
    const jobs = []
    for (const row of rows) {
      const job = await db.notificationJob.update({ where: { id: row.id }, data: { status: 'processing',
        claimToken: randomUUID(), leaseUntil: new Date(now.getTime() + LEASE_MS), sendingAt: null,
        result: null, diagnostic: null, attempts: { increment: 1 } } })
      jobs.push({ id: job.id, claimToken: job.claimToken, leaseUntil: job.leaseUntil })
    }
    return jobs
  })
}
async function lockJob(db: Database, id: string, token: string) {
  await db.$queryRaw`SELECT id FROM notification_jobs WHERE id = ${id}::uuid FOR UPDATE`
  const job = await db.notificationJob.findUnique({ where: { id } })
  if (!job || job.claimToken !== token) throw new AppError(409, 'Reclamo obsoleto')
  return job
}
async function eligible(db: Database, job: NotificationJob, now: Date) {
  const task = await db.task.findUnique({ where: { id: job.taskId }, include: { assignee: true, project: true } })
  if (!task || task.assigneeId !== job.recipientId || !task.assignee || task.status === 'COMPLETED' || task.project.status !== 'ACTIVE') return null
  const member = await db.projectMember.findUnique({ where: { userId_projectId: { userId: job.recipientId, projectId: task.projectId } } })
  if (!member) return null
  if (job.kind === 'assigned') return task.assignmentVersion === job.assignmentVersion ? task : null
  if (!task.dueDate || task.dueDate.getTime() !== job.dueDate?.getTime()) return null
  const delta = task.dueDate.getTime() - now.getTime()
  return (job.kind === 'overdue' ? delta <= 0 : delta > 0 && delta <= 86400000) ? task : null
}
export async function prepareJob(id: string, token: string, now = new Date()) {
  return prisma.$transaction(async db => {
    const job = await lockJob(db, id, token)
    if (job.status !== 'processing' || job.sendingAt || !job.leaseUntil || job.leaseUntil <= now)
      throw new AppError(409, 'Reclamo no disponible para enviar')
    const task = await eligible(db, job, now)
    if (!task) {
      await db.notificationJob.update({ where: { id }, data: { status: 'cancelled', diagnostic: 'CONTEXT_OBSOLETE' } })
      return null
    }
    await db.notificationJob.update({ where: { id }, data: { sendingAt: now } })
    return { id, kind: job.kind, recipient: task.assignee!.email, recipientName: task.assignee!.name,
      title: task.title, project: task.project.name, projectId: task.projectId,
      dueDate: task.dueDate?.toISOString() ?? null, messageId: `<${id}@synkro.local>` }
  })
}
export type DeliveryResult = 'accepted' | 'temporary' | 'permanent' | 'unknown'
export async function completeJob(id: string, token: string, result: DeliveryResult, diagnostic: string, now = new Date()) {
  return prisma.$transaction(async db => {
    const job = await lockJob(db, id, token)
    if (job.result === result) return { status: job.status }
    if (!['processing', 'unknown'].includes(job.status) || job.result)
      throw new AppError(409, 'Resultado incompatible')
    if (!job.sendingAt && result === 'accepted') throw new AppError(409, 'Envío no preparado')
    const status = result === 'accepted' ? 'sent' : result === 'unknown' ? 'unknown' :
      result === 'temporary' && job.attempts < MAX_ATTEMPTS ? 'pending' : 'failed'
    await db.notificationJob.update({ where: { id }, data: { status, result, diagnostic,
      acceptedAt: result === 'accepted' ? now : null,
      nextAttemptAt: new Date(now.getTime() + Math.min(3600000, 30000 * 2 ** (job.attempts - 1))) } })
    return { status }
  })
}
