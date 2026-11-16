import { beforeEach, afterAll, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../src/app'
import prisma from '../src/utils/prismaClient'
import { createTask, updateTask } from '../src/services/task.service'
import { claimJobs, prepareJob, completeJob, planReminders, enqueueAssignment, LEASE_MS } from '../src/services/notification.service'
let owner: number, member: number, project: number
const now = new Date(Date.now() + 86400000)
beforeEach(async () => {
  await prisma.notificationJob.deleteMany(); await prisma.project.deleteMany(); await prisma.user.deleteMany()
  owner = (await prisma.user.create({ data: { name: 'Owner', email: 'owner@example.invalid', password: 'synthetic' } })).id
  member = (await prisma.user.create({ data: { name: 'Member', email: 'member@example.invalid', password: 'synthetic' } })).id
  project = (await prisma.project.create({ data: { name: 'Notificaciones', members: { create: [{ userId: owner, role: 'OWNER' }, { userId: member }] } } })).id
})
afterAll(() => prisma.$disconnect())
const assigned = () => createTask(project, owner, { title: 'Tarea sintética', assigneeId: member })
it('asignación durable, sin fecha, sin duplicar no-op ni notificar autoasignación', async () => {
  const task = await assigned()
  await updateTask(task.id, owner, { expectedVersion: 1, title: task.title })
  await createTask(project, owner, { title: 'Autoasignada', assigneeId: owner })
  expect(await prisma.notificationJob.count()).toBe(1)
  const [claim] = await claimJobs(1)
  expect(await prepareJob(claim.id, claim.claimToken!)).toMatchObject({ recipient: 'member@example.invalid', dueDate: null })
  expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).version).toBe(1)
})
it('rollback de intención y cambio de tarea ante fallo transaccional', async () => {
  await expect(prisma.$transaction(async db => {
    const task = await db.task.create({ data: { title: 'Rollback', projectId: project, assigneeId: member, assignmentVersion: 1 } })
    await enqueueAssignment(db, task, owner)
    throw Error('synthetic rollback')
  })).rejects.toThrow('synthetic rollback')
  expect(await prisma.task.count()).toBe(0); expect(await prisma.notificationJob.count()).toBe(0)
})
it('planificador repetible, límites temporales y cambio de vencimiento', async () => {
  const task = await createTask(project, owner, { title: 'Próxima', assigneeId: owner, dueDate: new Date(now.getTime()+86400000).toISOString() })
  await planReminders(0, now); await planReminders(0, now)
  expect(await prisma.notificationJob.count()).toBe(1)
  await updateTask(task.id, owner, { expectedVersion: 1, title: 'Solo título' })
  await planReminders(0, now); expect(await prisma.notificationJob.count()).toBe(1)
  await updateTask(task.id, owner, { expectedVersion: 2, dueDate: now.toISOString() })
  await planReminders(0, now); expect(await prisma.notificationJob.count()).toBe(2)
  const claims = await claimJobs(10, now)
  for (const claim of claims) {
    const job = await prisma.notificationJob.findUniqueOrThrow({ where: { id: claim.id } })
    expect((await prepareJob(claim.id, claim.claimToken!, now))?.kind ?? null).toBe(job.kind === 'overdue' ? 'overdue' : null)
  }
})
it.each(['reassigned','date','member','completed','paused'] as const)('cancela contexto obsoleto: %s', async change => {
  const task = await assigned()
  if (change === 'reassigned') {
    await updateTask(task.id, owner, { expectedVersion: 1, assigneeId: owner })
    await updateTask(task.id, owner, { expectedVersion: 2, assigneeId: member })
  } else if (change === 'member') await prisma.projectMember.delete({ where: { userId_projectId: { userId: member, projectId: project } } })
  else if (change === 'completed') await updateTask(task.id, owner, { expectedVersion: 1, status: 'COMPLETED' })
  else if (change === 'paused') await prisma.project.update({ where: { id: project }, data: { status: 'PAUSED' } })
  else {
    await prisma.notificationJob.updateMany({ data: { kind: 'due_soon', dueDate: now } })
  }
  const claims = await claimJobs(10)
  const oldest = await prisma.notificationJob.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })
  const claim = claims.find(c => c.id === oldest.id)!
  expect(await prepareJob(claim.id, claim.claimToken!)).toBeNull()
})
it('dos reclamos independientes no comparten trabajos y confirmación es idempotente', async () => {
  await assigned()
  const claims = (await Promise.all([claimJobs(1), claimJobs(1)])).flat()
  expect(claims).toHaveLength(1)
  const job = claims[0]
  await prepareJob(job.id, job.claimToken!)
  await completeJob(job.id, job.claimToken!, 'accepted', 'SMTP_ACCEPTED')
  expect(await completeJob(job.id, job.claimToken!, 'accepted', 'SMTP_ACCEPTED')).toEqual({ status: 'sent' })
  expect(await claimJobs(10)).toHaveLength(0)
})
it('backoff acotado, reclamo anterior rechazado, expiración unknown sin reenvío', async () => {
  await assigned()
  let [job] = await claimJobs(1, now)
  const old = job.claimToken!
  await completeJob(job.id, old, 'temporary', 'SMTP_TEMPORARY', now)
  expect(await claimJobs(1, new Date(now.getTime()+1000))).toHaveLength(0)
  ;[job] = await claimJobs(1, new Date(now.getTime()+31000))
  await expect(completeJob(job.id, old, 'accepted', 'SMTP_ACCEPTED')).rejects.toMatchObject({ statusCode: 409 })
  expect(await claimJobs(1, new Date(now.getTime()+31000+LEASE_MS))).toHaveLength(0)
  expect((await prisma.notificationJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe('unknown')
})
it('quinto fallo temporal termina failed', async () => {
  await assigned()
  await prisma.notificationJob.updateMany({ data: { attempts: 4 } })
  const [job] = await claimJobs(1, now)
  expect(await completeJob(job.id, job.claimToken!, 'temporary', 'SMTP_TEMPORARY', now)).toEqual({ status: 'failed' })
  expect(await claimJobs(10, new Date(now.getTime()+86400000))).toHaveLength(0)
})
it('contrato interno rechaza usuario, Origin y cuerpos fuera de límites', async () => {
  vi.stubEnv('NOTIFICATION_INTERNAL_SECRET', 'synthetic-internal-secret-with-32-bytes')
  try {
    expect((await request(app).post('/api/internal/notifications/claim').send({ limit: 1 })).status).toBe(401)
    const call = () => request(app).post('/api/internal/notifications/claim').set('X-Synkro-Service', process.env.NOTIFICATION_INTERNAL_SECRET!)
    expect((await call().set('Origin', 'http://localhost:5173').send({ limit: 1 })).status).toBe(401)
    expect((await call().send({ limit: 11 })).status).toBe(400)
    const ok = await call().send({ limit: 1 })
    expect(ok.status).toBe(200); expect(ok.headers['access-control-allow-origin']).toBeUndefined()
  } finally { vi.unstubAllEnvs() }
})
