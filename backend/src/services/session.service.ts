import { randomBytes, createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { authConfig as config } from '../config/auth'

export const publicUser = { id: true, name: true, email: true, role: true, avatarColor: true, avatarUrl: true, createdAt: true } as const
export const claimsSchema = z.object({
  userId: z.number().int().positive(),
  sessionId: z.string().uuid(),
  purpose: z.literal('access'),
  exp: z.number().int().positive(),
  iat: z.number().int().nonnegative(),
})
export const hashRefresh = (token: string) => createHash('sha256').update(token).digest('hex')
const newRefresh = () => randomBytes(32).toString('base64url')
const invalid = () => new AppError(401, 'Sesión inválida o expirada')
export function accessToken(session: { id: string; userId: number; expiresAt: Date }) {
  const now = Math.floor(Date.now() / 1000)
  const exp = Math.min(now + config.ACCESS_TOKEN_TTL_SECONDS, Math.floor(session.expiresAt.getTime() / 1000))
  if (exp <= now) throw invalid()
  return jwt.sign({ userId: session.userId, sessionId: session.id, purpose: 'access', iat: now, exp },
    config.JWT_SECRET, { algorithm: 'HS256', issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE })
}
export function verifyAccess(token: string) {
  return claimsSchema.parse(jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256'], issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE,
  }))
}
type Db = Prisma.TransactionClient
// Orden común: usuario -> sesión -> refresh. Login y cambio de contraseña
// verifican la contraseña DESPUÉS de bloquear el mismo usuario.
export async function lockUser(db: Db, id: number) {
  await db.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`
  return db.user.findUnique({ where: { id } })
}
export const login = (body: { email: string; password: string }) => prisma.$transaction(async db => {
  const candidate = await db.user.findUnique({ where: { email: body.email }, select: { id: true } })
  const user = candidate ? await lockUser(db, candidate.id) : null
  if (!user || !await bcrypt.compare(body.password, user.password)) throw new AppError(401, 'Credenciales inválidas')
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_SECONDS * 1000)
  const raw = newRefresh()
  const session = await db.authSession.create({ data: { userId: user.id, expiresAt, refreshTokens: { create: { tokenHash: hashRefresh(raw) } } } })
  const profile = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: publicUser })
  return { accessToken: accessToken(session), refreshToken: raw, expiresAt, user: profile }
}, { timeout: 15000 })

export async function refresh(raw: unknown) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw invalid()
  const result = await prisma.$transaction(async db => {
    const found = await db.refreshToken.findUnique({ where: { tokenHash: hashRefresh(raw) }, include: { session: true } })
    if (!found) return null
    const user = await lockUser(db, found.session.userId)
    if (!user) return null
    await db.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${found.sessionId}::uuid FOR UPDATE`
    const token = await db.refreshToken.findUnique({ where: { id: found.id }, include: { session: true } })
    if (!token || token.session.revokedAt || token.session.expiresAt.getTime() <= Date.now() + 1000) return null
    if (token.consumedAt) {
      await db.authSession.update({ where: { id: token.sessionId }, data: { revokedAt: new Date(), revokeReason: 'REFRESH_REUSE' } })
      // Retornar, no lanzar: la revocación debe hacer COMMIT antes del 401.
      return null
    }
    await db.refreshToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } })
    const replacement = newRefresh()
    await db.refreshToken.create({ data: { sessionId: token.sessionId, tokenHash: hashRefresh(replacement) } })
    return { accessToken: accessToken(token.session), refreshToken: replacement, expiresAt: token.session.expiresAt }
  }, { timeout: 15000 })
  if (!result) throw invalid()
  return result
}
export async function logout(raw: unknown) {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return
  await prisma.$transaction(async db => {
    const token = await db.refreshToken.findUnique({ where: { tokenHash: hashRefresh(raw) }, include: { session: true } })
    if (!token) return
    await lockUser(db, token.session.userId)
    await db.authSession.updateMany({ where: { id: token.sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'LOGOUT' } })
  })
}
export const changePassword = (userId: number, body: { currentPassword: string; newPassword: string }) => prisma.$transaction(async db => {
  const user = await lockUser(db, userId)
  if (!user || !await bcrypt.compare(body.currentPassword, user.password)) throw new AppError(401, 'La contraseña actual es incorrecta')
  const password = await bcrypt.hash(body.newPassword, 10)
  await db.user.update({ where: { id: userId }, data: { password } })
  await db.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGED' } })
}, { timeout: 15000 })
export const getProfile = (userId: number) => prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser })
