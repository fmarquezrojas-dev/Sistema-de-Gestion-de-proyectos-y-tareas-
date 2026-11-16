import { RequestHandler, Response, CookieOptions } from 'express'
import { authConfig as config } from '../config/auth'
export const cookieOptions: CookieOptions = {
  httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth',
}
export const setRefreshCookie = (res: Response, token: string, expiresAt: Date) => {
  // Retirar cookie heredada con path=/ al pasar del bloque 1 al 2.
  res.clearCookie('refreshToken', { ...cookieOptions, path: '/' })
  res.cookie('refreshToken', token, { ...cookieOptions, expires: expiresAt })
}
export const clearRefreshCookie = (res: Response) => {
  res.clearCookie('refreshToken', cookieOptions)
  res.clearCookie('refreshToken', { ...cookieOptions, path: '/' })
}
export const requireOrigin: RequestHandler = (req, res, next) => {
  if (!req.headers.origin || !config.origins.includes(req.headers.origin)) {
    return res.status(403).json({ error: 'Origen no autorizado' })
  }
  next()
}
export function rateLimit(limit: number, windowMs = config.AUTH_RATE_WINDOW_SECONDS * 1000): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>()
  return (req, res, next) => {
    const now = Date.now()
    for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key)
    const key = req.ip || 'unknown'
    let bucket = buckets.get(key)
    if (!bucket) {
      if (buckets.size >= 10000) return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde' })
      bucket = { count: 0, until: now + windowMs }; buckets.set(key, bucket)
    }
    if (++bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000))
      return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde' })
    }
    next()
  }
}
