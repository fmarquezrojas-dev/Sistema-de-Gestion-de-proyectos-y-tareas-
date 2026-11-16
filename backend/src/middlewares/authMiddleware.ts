import { Request, Response, NextFunction } from 'express'
import { AppError } from './errorHandler'
import { verifyAccess } from '../services/session.service'
import prisma from '../utils/prismaClient'
export const actorId = (req: Request): number => {
  if (!req.user) throw new AppError(401, 'No autenticado')
  return req.user.userId
}
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const reject = () => res.status(401).json({ error: 'Sesión inválida o expirada', code: 'SESSION_INVALID' })
  const header = req.headers.authorization
  let claims: ReturnType<typeof verifyAccess>
  try {
    if (!header?.startsWith('Bearer ')) return reject()
    claims = verifyAccess(header.slice(7))
  } catch { return reject() }
  try {
    const session = await prisma.authSession.findUnique({ where: { id: claims.sessionId }, include: { user: true } })
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return reject()
    req.user = { userId: session.userId, sessionId: session.id, email: session.user.email, role: session.user.role }
    next()
  } catch (error) { next(error) }
}
