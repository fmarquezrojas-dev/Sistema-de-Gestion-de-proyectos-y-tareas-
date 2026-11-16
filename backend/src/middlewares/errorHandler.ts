import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(public statusCode: number, public message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if ('type' in err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande' })
  if ('type' in err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' })
  if (err instanceof ZodError) return res.status(400).json({ error: 'Datos inválidos', errors: err.flatten() })
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'El recurso ya existe' })
    if (err.code === 'P2025') return res.status(404).json({ error: 'Recurso no encontrado' })
    if (err.code === 'P2003') return res.status(409).json({ error: 'El recurso tiene relaciones activas. Revisa sus dependencias' })
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, ...err.details })
  }
  console.error('[API] Error interno', err.name)
  res.status(500).json({ error: 'Error interno del servidor' })
}