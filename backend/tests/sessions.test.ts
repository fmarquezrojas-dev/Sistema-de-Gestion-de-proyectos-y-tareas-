import { beforeEach, afterAll, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import app from '../src/app'
import prisma from '../src/utils/prismaClient'
import { hashRefresh, accessToken } from '../src/services/session.service'
import { authConfig as config, readAuthConfig } from '../src/config/auth'

const origin = 'http://localhost:5173'
const password = 'synthetic-password-123'
let userId: number
let clock = Date.now()
const cookie = (response: request.Response) => {
  const values = response.headers['set-cookie'] as unknown as string[]
  return values.find(value => value.startsWith('refreshToken=') && value.includes('Path=/api/auth') && !value.startsWith('refreshToken=;'))!.split(';')[0]
}
const login = () => request(app).post('/api/auth/login').set('Origin', origin).send({ email: 'session@example.invalid', password })
const refresh = (value: string) => request(app).post('/api/auth/refresh').set('Origin', origin).set('Cookie', value)
const logout = (value: string) => request(app).post('/api/auth/logout').set('Origin', origin).set('Cookie', value)
const me = (token: string) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
beforeEach(async () => {
  clock += 61000
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(clock)
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()
  userId = (await prisma.user.create({ data: { name: 'Synthetic', email: 'session@example.invalid', password: await bcrypt.hash(password, 4) } })).id
})
afterAll(async () => { vi.useRealTimers(); await prisma.$disconnect() })

it('login crea una sesión independiente; guarda solo hash y entrega cookie restringida', async () => {
  const response = await login()
  expect(response.status).toBe(200)
  expect(response.headers['cache-control']).toBe('no-store')
  const value = cookie(response)
  const raw = value.split('=')[1]
  expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/)
  const stored = await prisma.refreshToken.findFirstOrThrow({ include: { session: true } })
  expect(stored.tokenHash).toBe(hashRefresh(raw))
  expect(JSON.stringify(stored)).not.toContain(raw)
  expect(JSON.stringify(response.body)).not.toContain(raw)
  expect(response.body.data.user.password).toBeUndefined()
  const setCookie = (response.headers['set-cookie'] as unknown as string[]).find(v => v.startsWith(value))!
  expect(setCookie).toContain('HttpOnly'); expect(setCookie).toContain('SameSite=Strict'); expect(setCookie).toContain('Path=/api/auth')
  expect(setCookie).not.toContain('Secure')
  const claims = jwt.decode(response.body.data.accessToken) as jwt.JwtPayload
  expect(claims).toMatchObject({ userId, sessionId: stored.sessionId, purpose: 'access', iss: config.JWT_ISSUER, aud: config.JWT_AUDIENCE })
  expect(claims.exp! - claims.iat!).toBeLessThanOrEqual(900)
  expect(stored.session.expiresAt.getTime() - Date.now()).toBe(604800000)
  await login(); expect(await prisma.authSession.count()).toBe(2)
})
it('rota atómicamente, conserva hashes consumidos y el vencimiento absoluto', async () => {
  const first = await login()
  const session = await prisma.authSession.findFirstOrThrow()
  await prisma.authSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + 50000) } })
  const rotated = await refresh(cookie(first))
  expect(rotated.status).toBe(200)
  expect(cookie(rotated)).not.toBe(cookie(first))
  const rows = await prisma.refreshToken.findMany()
  expect(rows).toHaveLength(2)
  expect(rows.filter(row => row.consumedAt)).toHaveLength(1)
  const claims = jwt.decode(rotated.body.data.accessToken) as jwt.JwtPayload
  expect(claims.exp! * 1000).toBeLessThanOrEqual(Date.now() + 50000)
  expect((await prisma.authSession.findFirstOrThrow()).expiresAt.getTime()).toBe(Date.now() + 50000)
})
it('reutilización confirma revocación pese al 401 e invalida access y reemplazo', async () => {
  const first = await login()
  const next = await refresh(cookie(first))
  expect((await refresh(cookie(first))).status).toBe(401)
  const stored = await prisma.authSession.findFirstOrThrow()
  expect(stored.revokedAt).not.toBeNull(); expect(stored.revokeReason).toBe('REFRESH_REUSE')
  expect((await refresh(cookie(next))).status).toBe(401)
  expect((await me(next.body.data.accessToken)).status).toBe(401)
})
it('dos refresh reales simultáneos no dejan dos reemplazos utilizables', async () => {
  const first = await login()
  const responses = await Promise.all([refresh(cookie(first)), refresh(cookie(first))])
  expect(responses.map(r => r.status).sort()).toEqual([200, 401])
  expect(await prisma.refreshToken.count()).toBe(2)
  expect((await prisma.authSession.findFirstOrThrow()).revokeReason).toBe('REFRESH_REUSE')
  const winner = responses.find(r => r.status === 200)!
  expect((await refresh(cookie(winner))).status).toBe(401)
  expect((await me(winner.body.data.accessToken)).status).toBe(401)
})
it('refresh desconocido no revoca sesiones ajenas', async () => {
  const first = await login()
  expect((await refresh('refreshToken=' + randomBytes(32).toString('base64url'))).status).toBe(401)
  expect((await me(first.body.data.accessToken)).status).toBe(200)
  expect((await prisma.authSession.findFirstOrThrow()).revokedAt).toBeNull()
})
it('rechaza sesiones expiradas/revocadas y JWT antiguos sin sesión', async () => {
  const first = await login()
  const session = await prisma.authSession.findFirstOrThrow()
  await prisma.authSession.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  expect((await refresh(cookie(first))).status).toBe(401)
  expect((await me(first.body.data.accessToken)).status).toBe(401)
  const second = await login()
  await logout(cookie(second))
  expect((await refresh(cookie(second))).status).toBe(401)
  const legacy = jwt.sign({ userId, email: 'session@example.invalid', role: 'ADMIN' }, config.JWT_SECRET, { expiresIn: '15m' })
  expect((await me(legacy)).status).toBe(401)
})
it('logout es idempotente, funciona con access expirado y no revoca otras sesiones', async () => {
  const first = await login(), second = await login()
  const expired = jwt.sign({ userId, sessionId: randomUUID(), purpose: 'access', exp: Math.floor(Date.now()/1000)-1 }, config.JWT_SECRET)
  const response = await logout(cookie(first)).set('Authorization', `Bearer ${expired}`)
  expect(response.status).toBe(200)
  const cookies = response.headers['set-cookie'] as unknown as string[]
  expect(cookies.some(v => v.includes('Path=/api/auth') && v.includes('Expires=Thu, 01 Jan 1970'))).toBe(true)
  expect((await logout(cookie(first))).status).toBe(200)
  expect((await me(first.body.data.accessToken)).status).toBe(401)
  expect((await me(second.body.data.accessToken)).status).toBe(200)
})
it('cambiar contraseña revoca todas las sesiones y exige contraseña actual válida', async () => {
  const first = await login(), second = await login()
  const change = (currentPassword: string, newPassword: string) => request(app).put('/api/auth/password').set('Origin', origin)
    .set('Authorization', `Bearer ${first.body.data.accessToken}`).send({ currentPassword, newPassword })
  expect((await change('incorrecta', 'synthetic-new-password')).status).toBe(401)
  expect((await change(password, 'short')).status).toBe(400)
  const result = await change(password, 'synthetic-new-password')
  expect(result.status).toBe(200)
  expect(result.headers['set-cookie']).toBeDefined()
  expect(await prisma.authSession.count({ where: { revokedAt: null } })).toBe(0)
  expect((await me(second.body.data.accessToken)).status).toBe(401)
  expect((await refresh(cookie(first))).status).toBe(401)
  expect((await login()).status).toBe(401)
})
it('login concurrente con contraseña anterior no deja una sesión válida tras el cambio', async () => {
  const first = await login()
  let unlock!: () => void, acquired!: () => void
  const ready = new Promise<void>(resolve => { acquired = resolve })
  const held = prisma.$transaction(async db => {
    await db.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    acquired()
    await new Promise<void>(resolve => { unlock = resolve })
  }, { timeout: 15000 })
  await ready
  const changing = request(app).put('/api/auth/password').set('Origin', origin).set('Authorization', `Bearer ${first.body.data.accessToken}`)
    .send({ currentPassword: password, newPassword: 'synthetic-new-password' }).then(r => r)
  const signingIn = login().then(r => r)
  let waiting = 0
  try {
    for (let n = 0; n < 200; n++) {
      const rows = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM users%FOR UPDATE%'`
      waiting = rows[0].count
      if (waiting >= 2) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  } finally { unlock() }
  await held
  expect(waiting).toBeGreaterThanOrEqual(2)
  const [changed, signedIn] = await Promise.all([changing, signingIn])
  expect(changed.status).toBe(200); expect([200,401]).toContain(signedIn.status)
  expect(await prisma.authSession.count({ where: { userId, revokedAt: null } })).toBe(0)
})
it('rechaza claims, propósito, issuer, audience, firma y algoritmo incorrectos', async () => {
  const first = await login()
  const session = await prisma.authSession.findFirstOrThrow()
  const base = { userId, sessionId: session.id, purpose: 'access' }
  const options = { issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE, expiresIn: 900 }
  const bad = [
    jwt.sign({ ...base, userId: String(userId) }, config.JWT_SECRET, options),
    jwt.sign({ ...base, purpose: 'refresh' }, config.JWT_SECRET, options),
    jwt.sign({ ...base, sessionId: randomUUID() }, config.JWT_SECRET, options),
    jwt.sign(base, config.JWT_SECRET, { ...options, issuer: 'other' }),
    jwt.sign(base, config.JWT_SECRET, { ...options, audience: 'other' }),
    jwt.sign(base, 'different-synthetic-signing-secret-123456', options),
    jwt.sign(base, config.JWT_SECRET, { ...options, algorithm: 'HS384' }),
    jwt.sign(base, config.JWT_SECRET, { ...options, expiresIn: -1 }),
    cookie(first).split('=')[1],
  ]
  for (const token of bad) expect((await me(token)).status).toBe(401)
  expect((await me(accessToken(session))).status).toBe(200)
})
it('valida Origin explícitamente y no depende solo de CORS', async () => {
  for (const endpoint of ['login', 'register', 'refresh', 'logout']) {
    expect((await request(app).post('/api/auth/' + endpoint).send({})).status).toBe(403)
    expect((await request(app).post('/api/auth/' + endpoint).set('Origin','https://attacker.invalid').send({})).status).toBe(403)
  }
  const first = await login()
  expect(first.headers['access-control-allow-origin']).toBe(origin)
  expect(first.headers['access-control-allow-credentials']).toBe('true')
})
it('límites de las cuatro rutas producen 429 con Retry-After sin confiar en X-Forwarded-For', async () => {
  const routes = [
    { path: '/login', max: config.AUTH_LOGIN_LIMIT, method: 'post' },
    { path: '/register', max: config.AUTH_REGISTER_LIMIT, method: 'post' },
    { path: '/refresh', max: config.AUTH_REFRESH_LIMIT, method: 'post' },
    { path: '/password', max: config.AUTH_PASSWORD_LIMIT, method: 'put' },
  ] as const
  for (const route of routes) {
    for (let i = 0; i < route.max; i++) {
      const result = await request(app)[route.method]('/api/auth' + route.path).set('Origin',origin).set('X-Forwarded-For', `192.0.2.${i}`).send({})
      expect(result.status).not.toBe(429)
    }
    const result = await request(app)[route.method]('/api/auth' + route.path).set('Origin', origin).send({})
    expect(result.status).toBe(429); expect(result.headers['retry-after']).toBeDefined()
  }
})
it('configuración rechaza secretos cortos, comodines, duraciones excesivas y producción sin HTTPS', () => {
  for (const patch of [
    { JWT_SECRET: 'short' }, { AUTH_ALLOWED_ORIGINS: '*' }, { ACCESS_TOKEN_TTL_SECONDS: '901' },
    { SESSION_TTL_SECONDS: '604801' }, { NODE_ENV: 'invalid' }, { JWT_ISSUER: '' },
    { NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS: origin },
  ]) expect(() => readAuthConfig({ ...process.env, ...patch })).toThrow()
})

it('producción crea y borra cookies Secure con el mismo path', async () => {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('AUTH_ALLOWED_ORIGINS', 'https://synkro.example.invalid')
  const { default: productionApp } = await import('../src/app')
  const { default: productionDb } = await import('../src/utils/prismaClient')
  try {
    const signed = await request(productionApp).post('/api/auth/login').set('Origin', 'https://synkro.example.invalid')
      .send({ email: 'session@example.invalid', password })
    expect(signed.status).toBe(200)
    const value = cookie(signed)
    const cookies = signed.headers['set-cookie'] as unknown as string[]
    expect(cookies.find(item => item.startsWith(value))).toContain('Secure')
    const closed = await request(productionApp).post('/api/auth/logout').set('Origin', 'https://synkro.example.invalid').set('Cookie', value)
    expect(closed.status).toBe(200)
    const clearing = (closed.headers['set-cookie'] as unknown as string[]).find(item => item.includes('Path=/api/auth'))!
    expect(clearing).toContain('Secure'); expect(clearing).toContain('HttpOnly'); expect(clearing).toContain('SameSite=Strict')
  } finally { await productionDb.$disconnect(); vi.unstubAllEnvs(); vi.resetModules() }
})
