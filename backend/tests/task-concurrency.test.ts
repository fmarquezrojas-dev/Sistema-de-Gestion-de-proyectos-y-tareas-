import { beforeEach, afterAll, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../src/app'
import prisma from '../src/utils/prismaClient'
let owner: number, editor: number, reader: number, outsider: number, projectId: number, taskId: number
const tokens = new Map<number,string>()
let clock = Date.now()
const api = (userId: number) => {
  const auth = `Bearer ${tokens.get(userId)}`
  return {
    get: (path: string) => request(app).get('/api'+path).set('Authorization',auth),
    post: (path: string, body: object) => request(app).post('/api'+path).set('Authorization',auth).send(body),
    put: (body: object) => request(app).put(`/api/tasks/${taskId}`).set('Authorization',auth).send(body),
    status: (body: object) => request(app).patch(`/api/tasks/${taskId}/status`).set('Authorization',auth).send(body),
    delete: (path: string, body?: object) => request(app).delete('/api'+path).set('Authorization',auth).send(body),
  }
}
beforeEach(async () => {
  clock += 61000; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(clock)
  await prisma.project.deleteMany(); await prisma.user.deleteMany()
  const password = 'synthetic-version-password'
  const hash = await bcrypt.hash(password,4)
  const users = await Promise.all(['owner','editor','reader','outsider'].map(name =>
    prisma.user.create({ data: { name, email: `version-${name}@example.invalid`, password: hash } })))
  ;[owner,editor,reader,outsider] = users.map(u => u.id)
  for (const user of users) {
    const res = await request(app).post('/api/auth/login').set('Origin','http://localhost:5173').send({ email: user.email, password })
    expect(res.status).toBe(200); tokens.set(user.id, res.body.data.accessToken)
  }
  projectId = (await api(owner).post('/projects', { name: 'Versionado' })).body.data.id
  await prisma.projectMember.createMany({ data: [{ projectId, userId: editor, canEditTasks: true }, { projectId, userId: reader }] })
  const created = await api(owner).post(`/tasks/project/${projectId}`, { title: 'Original', description: 'Inicial', assigneeId: reader })
  expect(created.status).toBe(201); expect(created.body.data.version).toBe(1); taskId = created.body.data.id
})
afterAll(async () => { vi.useRealTimers(); await prisma.$disconnect() })
const history = () => api(owner).get(`/tasks/${taskId}/activity`)
it('cambio efectivo incrementa versión y registra diferencias y actor', async () => {
  const date = '2027-05-01T12:00:00.000Z'
  const res = await api(editor).put({ expectedVersion: 1, title: 'Nuevo', description: 'Revisada', status: 'IN_PROGRESS', priority: 'HIGH', dueDate: date, assigneeId: editor })
  expect(res.status).toBe(200); expect(res.body.data.version).toBe(2)
  const event = (await history()).body.data[0]
  expect(event).toMatchObject({ previousVersion: 1, resultingVersion: 2, actorName: 'editor', user: { id: editor },
    changes: { title: { before: 'Original', after: 'Nuevo' }, status: { before: 'PENDING', after: 'IN_PROGRESS' },
      priority: { before: 'MEDIUM', after: 'HIGH' }, description: { before: 'Inicial', after: 'Revisada' },
      dueDate: { before: null, after: date }, assigneeId: { before: { id: reader, name: 'reader' }, after: { id: editor, name: 'editor' } } } })
})
it('sin diferencias comprueba precondición y no crea eventos; comentarios no versionan', async () => {
  expect((await api(owner).put({ expectedVersion: 1, title: 'Original' })).body.data.version).toBe(1)
  expect((await history()).body.pagination.total).toBe(1)
  await api(reader).post(`/tasks/${taskId}/comments`, { content: 'Comentario separado' })
  expect((await api(owner).get(`/tasks/${taskId}`)).body.data.version).toBe(1)
  await api(owner).put({ expectedVersion: 1, title: 'Nuevo' })
  const stale = await api(owner).put({ expectedVersion: 1, title: 'Nuevo' })
  expect(stale.status).toBe(409); expect(stale.body.code).toBe('TASK_VERSION_CONFLICT')
  expect(stale.body.currentVersion).toBe(2)
  expect((await history()).body.pagination.total).toBe(2)
})
it('valida precondición obligatoria en PUT PATCH DELETE y rechaza version directa', async () => {
  for (const value of [undefined, null, 0, -1, 1.5, '1']) {
    expect((await api(owner).put({ expectedVersion: value, title: 'Nuevo' })).status).toBe(400)
    expect((await api(owner).status({ expectedVersion: value, status: 'COMPLETED' })).status).toBe(400)
    expect((await api(owner).delete(`/tasks/${taskId}`, { expectedVersion: value })).status).toBe(400)
  }
  expect((await api(owner).put({ expectedVersion: 1, version: 999 })).status).toBe(400)
})
it('autoriza antes de revelar versión; estado y borrado conservan permisos', async () => {
  for (const user of [reader, outsider]) {
    const expected = user === outsider ? 404 : 403
    for (const result of [await api(user).put({ expectedVersion: 99, title: 'Ajena' }),
      await api(user).status({ expectedVersion: 99, status: 'COMPLETED' }),
      await api(user).delete(`/tasks/${taskId}`, { expectedVersion: 99 })]) {
      expect(result.status).toBe(expected); expect(result.body.currentVersion).toBeUndefined(); expect(result.body.currentTask).toBeUndefined()
    }
  }
  expect((await api(editor).delete(`/tasks/${taskId}`, { expectedVersion: 1 })).status).toBe(403)
  expect((await api(owner).delete(`/tasks/${taskId}`, { expectedVersion: 99 })).status).toBe(409)
  expect((await api(owner).delete(`/tasks/${taskId}`, { expectedVersion: 1 })).status).toBe(200)
  expect(await prisma.activityLog.count({ where: { taskId } })).toBe(0)
})
it('retiro desasigna, versiona y registra motivo; formulario anterior entra en conflicto', async () => {
  const removed = await api(owner).delete(`/projects/${projectId}/members/${reader}`)
  expect(removed.status).toBe(200)
  expect((await api(owner).get(`/tasks/${taskId}`)).body.data).toMatchObject({ version: 2, assigneeId: null })
  expect((await history()).body.data[0]).toMatchObject({ reason: 'MEMBER_REMOVED', previousVersion: 1, resultingVersion: 2, user: { id: owner } })
  expect((await api(editor).put({ expectedVersion: 1, title: 'Viejo formulario' })).status).toBe(409)
})
it('borrar cuenta desasigna y aumenta versión; se mantiene cascada de historial del actor', async () => {
  expect((await api(reader).delete('/auth/account', { password: 'synthetic-version-password' })).status).toBe(200)
  expect((await api(owner).get(`/tasks/${taskId}`)).body.data).toMatchObject({ version: 2, assigneeId: null })
  // La política existente elimina los eventos del usuario eliminado.
  expect(await prisma.activityLog.count({ where: { taskId, userId: reader } })).toBe(0)
})
it('fallo real de inserción de historial revierte la tarea', async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE activity_logs ADD CONSTRAINT synthetic_history_failure CHECK ("taskTitle" <> 'FAIL_HISTORY_SYNTHETIC') NOT VALID`)
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const res = await api(owner).put({ expectedVersion: 1, title: 'FAIL_HISTORY_SYNTHETIC' })
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Error interno del servidor' })
    expect((await api(owner).get(`/tasks/${taskId}`)).body.data).toMatchObject({ title: 'Original', version: 1 })
    expect((await history()).body.pagination.total).toBe(1)
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE activity_logs DROP CONSTRAINT synthetic_history_failure')
    quiet.mockRestore()
  }
})
it('historial antiguo, paginación estable y acceso de miembro actual', async () => {
  await prisma.activityLog.create({ data: { type: 'TASK_UPDATED', description: 'Evento antiguo', userId: owner, taskId, projectId } })
  const first = await api(reader).get(`/tasks/${taskId}/activity?page=1&limit=1`)
  const second = await api(reader).get(`/tasks/${taskId}/activity?page=2&limit=1`)
  expect(first.status).toBe(200); expect(first.body.pagination.total).toBe(2)
  expect(first.body.data[0].id).not.toBe(second.body.data[0].id)
  expect(first.body.data[0].changes).toBeNull()
  expect((await api(outsider).get(`/tasks/${taskId}/activity`)).status).toBe(404)
  expect((await api(reader).get(`/tasks/${taskId}/activity?limit=51`)).status).toBe(400)
})
// Bloqueo de una tercera conexión fuerza solapamiento observable en PostgreSQL.
async function overlap(first: () => PromiseLike<request.Response>, second: () => PromiseLike<request.Response>) {
  let unlock!: () => void, acquired!: () => void
  const ready = new Promise<void>(resolve => { acquired = resolve })
  const hold = prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM tasks WHERE id = ${taskId} FOR UPDATE`
    acquired()
    await new Promise<void>(resolve => { unlock = resolve })
  }, { timeout: 15000 })
  await ready
  const one = Promise.resolve(first()), two = Promise.resolve(second())
  let waiting = 0
  try {
    for (let n = 0; n < 200; n++) {
      const [row] = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM tasks%FOR UPDATE%'`
      waiting = row.count
      if (waiting >= 2) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  } finally { unlock() }
  await hold
  expect(waiting).toBeGreaterThanOrEqual(2)
  return Promise.all([one,two])
}
it('edición y estado realmente solapados: un ganador, un 409 y un solo evento', async () => {
  const responses = await overlap(() => api(owner).put({ expectedVersion: 1, title: 'Ganador edición' }),
    () => api(editor).status({ expectedVersion: 1, status: 'COMPLETED' }))
  expect(responses.map(r => r.status).sort()).toEqual([200,409])
  const winner = responses.find(r => r.status === 200)!.body.data
  const final = (await api(owner).get(`/tasks/${taskId}`)).body.data
  expect(final.version).toBe(2); expect(final.title).toBe(winner.title); expect(final.status).toBe(winner.status)
  expect((await history()).body.pagination.total).toBe(2)
})
it('edición y retirada realmente solapadas mantienen versiones e integridad', async () => {
  const [edited, removed] = await overlap(() => api(editor).put({ expectedVersion: 1, title: 'Edición concurrente' }),
    () => api(owner).delete(`/projects/${projectId}/members/${reader}`))
  expect(removed.status).toBe(200); expect([200,409]).toContain(edited.status)
  const final = (await api(owner).get(`/tasks/${taskId}`)).body.data
  expect(final.assigneeId).toBeNull(); expect(final.version).toBe(edited.status === 200 ? 3 : 2)
  expect((await history()).body.pagination.total).toBe(final.version)
})
it('eliminar compite con editar usando la misma precondición', async () => {
  const [edited, deleted] = await overlap(() => api(editor).put({ expectedVersion: 1, title: 'Edición concurrente' }),
    () => api(owner).delete(`/tasks/${taskId}`, { expectedVersion: 1 }))
  if (deleted.status === 200) {
    expect(edited.status).toBe(404)
    expect((await api(owner).get(`/tasks/${taskId}`)).status).toBe(404)
  } else {
    expect(edited.status).toBe(200); expect(deleted.status).toBe(409)
    expect((await api(owner).get(`/tasks/${taskId}`)).body.data.version).toBe(2)
  }
})
