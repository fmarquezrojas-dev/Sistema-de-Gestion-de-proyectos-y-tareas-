import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import app from '../src/app'
import prisma from '../src/utils/prismaClient'
// @ts-expect-error Guard Node compartido.
import { assertTestDatabase } from '../scripts/test-database.mjs'

let owner: number, reader: number, creator: number, editor: number, outsider: number
let projectA: number, projectB: number, taskA: number, taskB: number
const password = 'synthetic-test-password'
const tokens = new Map<number, string>()
const token = (id: number) => tokens.get(id)!
const precondition = async (url: string, body: object = {}) => {
  const match = /^\/tasks\/(\d+)(?:\/status)?$/.exec(url)
  if (!match) return body
  const task = await prisma.task.findUnique({ where: { id: Number(match[1]) } })
  return { expectedVersion: task?.version ?? 1, ...body }
}
const api = (id: number) => {
  const auth = `Bearer ${token(id)}`
  return {
    get: (url: string) => request(app).get('/api' + url).set('Authorization', auth),
    post: (url: string, body: object) => request(app).post('/api' + url).set('Authorization', auth).send(body),
    put: async (url: string, body: object) => request(app).put('/api' + url).set('Authorization', auth).send(await precondition(url, body)),
    patch: async (url: string, body: object) => request(app).patch('/api' + url).set('Authorization', auth).send(await precondition(url, body)),
    delete: async (url: string, body?: object) => request(app).delete('/api' + url).set('Authorization', auth).send(await precondition(url, body)),
  }
}
beforeAll(async () => {
  const [identity] = await prisma.$queryRaw<{ database: string; username: string }[]>`SELECT current_database() AS database, current_user AS username`
  expect(identity).toEqual({ database: 'synkro_test', username: 'synkro_test' })
})
let clock = Date.now()
beforeEach(async () => {
  clock += 61000
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock)
  assertTestDatabase(process.env.DATABASE_URL)
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()
  const hashed = await bcrypt.hash(password, 4)
  const users = await Promise.all(['owner', 'reader', 'creator', 'editor', 'outsider'].map(name =>
    prisma.user.create({ data: { name, email: `${name}@example.invalid`, password: hashed, role: 'ADMIN' } })))
  ;[owner, reader, creator, editor, outsider] = users.map(u => u.id)
  tokens.clear()
  for (const user of users) {
    const response = await request(app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send({ email: user.email, password })
    expect(response.status).toBe(200)
    tokens.set(user.id, response.body.data.accessToken)
  }
  const a = await api(owner).post('/projects', { name: 'Proyecto A' })
  const b = await api(outsider).post('/projects', { name: 'Proyecto B' })
  expect(a.status).toBe(201); expect(b.status).toBe(201)
  projectA = a.body.data.id; projectB = b.body.data.id
  for (const user of users.slice(1, 4)) expect((await api(owner).post(`/projects/${projectA}/members`, { email: user.email })).status).toBe(201)
  await api(owner).patch(`/projects/${projectA}/members/${creator}/permissions`, { canCreateTasks: true, canEditTasks: false })
  await api(owner).patch(`/projects/${projectA}/members/${editor}/permissions`, { canCreateTasks: false, canEditTasks: true })
  taskA = (await api(owner).post(`/tasks/project/${projectA}`, { title: 'Tarea A', assigneeId: reader })).body.data.id
  taskB = (await api(outsider).post(`/tasks/project/${projectB}`, { title: 'Tarea B' })).body.data.id
})
afterAll(async () => { vi.useRealTimers(); await prisma.$disconnect() })

describe('Autorización HTTP real', () => {
  it('valida autenticación y payload antes de aceptar identidad', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401)
    for (const payload of [{ id: owner }, { userId: -1, email: 'x', role: 'OWNER' }, { userId: String(owner), email: 'x@example.invalid', role: 'ADMIN' }]) {
      const bad = jwt.sign(payload, process.env.JWT_SECRET!)
      expect((await request(app).get('/api/projects').set('Authorization', `Bearer ${bad}`)).status).toBe(401)
    }
  })
  it('OWNER administra proyecto y tareas; MEMBER solo consulta', async () => {
    expect((await api(owner).put(`/projects/${projectA}`, { name: 'Proyecto editado' })).status).toBe(200)
    expect((await api(owner).put(`/tasks/${taskA}`, { title: 'Actualizada' })).status).toBe(200)
    expect((await api(reader).get(`/projects/${projectA}`)).status).toBe(200)
    expect((await api(reader).get('/tasks/my-tasks')).body.data[0].canEdit).toBe(false)
    expect((await api(reader).get(`/tasks/project/${projectA}`)).status).toBe(200)
    expect((await api(reader).post(`/tasks/project/${projectA}`, { title: 'Denegada' })).status).toBe(403)
    expect((await api(reader).put(`/tasks/${taskA}`, { title: 'Denegada' })).status).toBe(403)
    expect((await api(owner).delete(`/tasks/${taskA}`)).status).toBe(200)
    expect((await api(owner).delete(`/projects/${projectA}`)).status).toBe(200)
  })
  it('crear no concede editar; editar no concede crear, eliminar ni administrar', async () => {
    expect((await api(creator).post(`/tasks/project/${projectA}`, { title: 'Permitida' })).status).toBe(201)
    expect((await api(creator).put(`/tasks/${taskA}`, { title: 'Denegada' })).status).toBe(403)
    expect((await api(editor).put(`/tasks/${taskA}`, { title: 'Permitida' })).status).toBe(200)
    expect((await api(editor).post(`/tasks/project/${projectA}`, { title: 'Denegada' })).status).toBe(403)
    expect((await api(editor).delete(`/tasks/${taskA}`)).status).toBe(403)
    expect((await api(editor).put(`/projects/${projectA}`, { name: 'Denegada' })).status).toBe(403)
    expect((await api(editor).post(`/projects/${projectA}/members`, { email: 'outsider@example.invalid' })).status).toBe(403)
    expect((await api(editor).delete(`/projects/${projectA}/members/${reader}`)).status).toBe(403)
    expect((await api(editor).patch(`/projects/${projectA}/members/${reader}/permissions`, { canCreateTasks: true, canEditTasks: true })).status).toBe(403)
    expect((await api(editor).delete(`/projects/${projectA}`)).status).toBe(403)
  })
  it('estado aplica la misma política en PATCH y PUT', async () => {
    for (const user of [reader, creator, outsider]) {
      const expected = user === outsider ? 404 : 403
      expect((await api(user).patch(`/tasks/${taskA}/status`, { status: 'COMPLETED' })).status).toBe(expected)
      expect((await api(user).put(`/tasks/${taskA}`, { status: 'COMPLETED' })).status).toBe(expected)
    }
    expect((await api(editor).patch(`/tasks/${taskA}/status`, { status: 'COMPLETED' })).status).toBe(200)
  })
  it('externos (incluso ADMIN global) no acceden por rutas alternativas', async () => {
    for (const route of [`/projects/${projectA}`, `/tasks/${taskA}`, `/tasks/project/${projectA}`, `/tasks/${taskA}/comments`, `/dashboard/project/${projectA}/summary`])
      expect((await api(outsider).get(route)).status).toBe(404)
    expect((await api(outsider).post(`/tasks/${taskA}/comments`, { content: 'Denegado' })).status).toBe(404)
    expect((await api(outsider).post(`/tasks/project/${projectA}`, { title: 'Denegada' })).status).toBe(404)
    const summary = await api(owner).get(`/dashboard/project/${projectA}/summary`)
    expect(summary.status).toBe(200); expect(summary.body[0].total_tasks).toBe(1)
  })
  it('comentarios: miembros actuales, autor y moderación OWNER; vínculo con taskId', async () => {
    const response = await api(reader).post(`/tasks/${taskA}/comments`, { content: '  Comentario  ' })
    expect(response.status).toBe(201); expect(response.body.data.content).toBe('Comentario')
    const id = response.body.data.id
    const otherTask = (await api(owner).post(`/tasks/project/${projectA}`, { title: 'Otra tarea' })).body.data.id
    expect((await api(reader).delete(`/tasks/${otherTask}/comments/${id}`)).status).toBe(404)
    expect((await api(reader).delete(`/tasks/${taskB}/comments/${id}`)).status).toBe(404)
    expect((await api(editor).delete(`/tasks/${taskA}/comments/${id}`)).status).toBe(403)
    expect((await api(owner).delete(`/tasks/${taskA}/comments/${id}`)).status).toBe(200)
    const own = (await api(reader).post(`/tasks/${taskA}/comments`, { content: 'Propio' })).body.data.id
    expect((await api(reader).delete(`/tasks/${taskA}/comments/${own}`)).status).toBe(200)
  })
  it('asignación del mismo proyecto y contrato ausencia/null', async () => {
    expect((await api(owner).post(`/tasks/project/${projectA}`, { title: 'Inválida', assigneeId: outsider })).status).toBe(400)
    expect((await api(owner).put(`/tasks/${taskA}`, { assigneeId: outsider })).status).toBe(400)
    expect((await api(owner).put(`/tasks/${taskA}`, { title: 'Conserva' })).body.data.assigneeId).toBe(reader)
    const date = '2027-01-02T12:00:00.000Z'
    expect((await api(owner).put(`/tasks/${taskA}`, { dueDate: date })).body.data.dueDate).toBe(date)
    const cleared = await api(owner).put(`/tasks/${taskA}`, { assigneeId: null, dueDate: null })
    expect(cleared.body.data.assigneeId).toBeNull(); expect(cleared.body.data.dueDate).toBeNull()
  })
  it('retiro desasigna solo su proyecto, conserva comentarios e impide accesos residuales', async () => {
    await api(outsider).post(`/projects/${projectB}/members`, { email: 'reader@example.invalid' })
    await api(outsider).put(`/tasks/${taskB}`, { assigneeId: reader })
    const comment = (await api(reader).post(`/tasks/${taskA}/comments`, { content: 'Historial' })).body.data.id
    await prisma.activityLog.create({ data: { type: 'TASK_UPDATED', description: 'Actividad histórica', userId: reader, projectId: projectA, taskId: taskA } })
    expect((await api(owner).delete(`/projects/${projectA}/members/${reader}`)).status).toBe(200)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: taskA } })).assigneeId).toBeNull()
    expect((await prisma.task.findUniqueOrThrow({ where: { id: taskB } })).assigneeId).toBe(reader)
    expect(await prisma.comment.findUnique({ where: { id: comment } })).not.toBeNull()
    // Simula una asignación heredada anterior a este bloque: las lecturas también deben filtrar.
    await prisma.task.update({ where: { id: taskA }, data: { assigneeId: reader, dueDate: new Date('2020-01-01') } })
    expect((await api(reader).get('/tasks/my-tasks')).body.data.map((t: { id: number }) => t.id)).toEqual([taskB])
    expect((await api(reader).get('/auth/profile/stats')).body.data.pendingTasks).toBe(1)
    const dash = (await api(reader).get('/dashboard')).body.data
    expect(dash.overdueTasks).toEqual([]);
    await prisma.task.update({ where: { id: taskA }, data: { dueDate: new Date(Date.now() + 86400000) } })
    expect((await api(reader).get('/dashboard')).body.data.upcomingTasks).toEqual([])
     expect(dash.recentActivity.every((entry: { projectName: string }) => entry.projectName === 'Proyecto B')).toBe(true)
    for (const route of [`/tasks/${taskA}`, `/tasks/${taskA}/comments`, `/dashboard/project/${projectA}/summary`])
      expect((await api(reader).get(route)).status).toBe(404)
    expect((await api(reader).delete(`/tasks/${taskA}/comments/${comment}`)).status).toBe(404)
  })
  it('bloquea retiro de cualquier OWNER y borrado de cuenta propietaria', async () => {
    expect((await api(owner).delete(`/projects/${projectA}/members/${owner}`)).status).toBe(409)
    await prisma.projectMember.update({ where: { userId_projectId: { userId: reader, projectId: projectA } }, data: { role: 'OWNER' } })
    expect((await api(owner).delete(`/projects/${projectA}/members/${reader}`)).status).toBe(409)
    expect((await api(owner).delete('/auth/account', { password })).status).toBe(409)
    expect(await prisma.project.findUnique({ where: { id: projectA } })).not.toBeNull()
    await api(owner).put(`/tasks/${taskA}`, { assigneeId: editor })
    expect((await api(editor).delete('/auth/account', { password })).status).toBe(200)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: taskA } })).assigneeId).toBeNull()
  })
  it('permite salida propia MEMBER y revoca su acceso', async () => {
    expect((await api(reader).delete(`/projects/${projectA}/members/${reader}`)).status).toBe(200)
    expect((await api(reader).get(`/projects/${projectA}`)).status).toBe(404)
  })
  it('rechaza identificadores, enumeraciones, fechas, contenido y propiedades privilegiadas', async () => {
    for (const id of ['0', '-1', '1.5', 'abc', '1abc']) expect((await api(owner).get(`/tasks/${id}`)).status).toBe(400)
    for (const query of ['limit=-1', 'limit=101', 'page=0', 'status=INVALID', 'priority=INVALID'])
      expect((await api(reader).get('/tasks/my-tasks?' + query)).status).toBe(400)
    for (const body of [{ status: 'INVALID' }, { priority: 'INVALID' }, { dueDate: '2026-02-30' }, { assigneeId: 0 }, { projectId: projectB }, { userId: owner }, { role: 'OWNER' }])
      expect((await api(owner).put(`/tasks/${taskA}`, body)).status).toBe(400)
    for (const content of ['  ', 'x'.repeat(5001)])
      expect((await api(reader).post(`/tasks/${taskA}/comments`, { content })).status).toBe(400)
    expect((await api(owner).patch(`/projects/${projectA}/members/${reader}/permissions`, { canCreateTasks: true, canEditTasks: true, role: 'OWNER' })).status).toBe(400)
    expect((await api(owner).patch(`/projects/${projectA}/members/${reader}/permissions`, { canCreateTasks: 'true', canEditTasks: false })).status).toBe(400)
  })
  it('retiro y asignación concurrentes mantienen integridad sin simular Prisma', async () => {
    for (let round = 0; round < 8; round++) {
      const results = await Promise.all([
        api(owner).put(`/tasks/${taskA}`, { assigneeId: reader }),
        api(owner).post(`/tasks/project/${projectA}`, { title: 'Concurrente', assigneeId: reader }),
        api(owner).delete(`/projects/${projectA}/members/${reader}`),
      ])
      expect(results[2].status).toBe(200)
      expect([200, 400, 409]).toContain(results[0].status)
      expect([201, 400, 409]).toContain(results[1].status)
      expect(await prisma.task.count({ where: { projectId: projectA, assigneeId: reader } })).toBe(0)
      expect((await api(owner).post(`/projects/${projectA}/members`, { email: 'reader@example.invalid' })).status).toBe(201)
    }
  })
})
