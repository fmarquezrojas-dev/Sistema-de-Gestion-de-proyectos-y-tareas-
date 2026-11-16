import { z } from 'zod'
const integer = (fallback: number, max: number) => z.coerce.number().int().positive().max(max).default(fallback)
export function readAuthConfig(env: NodeJS.ProcessEnv) {
  const parsed = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    JWT_SECRET: z.string().min(32).refine(v => !/tu_secreto|change.me|example|placeholder/i.test(v)),
    JWT_ISSUER: z.string().trim().min(1).max(200).default('synkro-api'),
    JWT_AUDIENCE: z.string().trim().min(1).max(200).default('synkro-web'),
    ACCESS_TOKEN_TTL_SECONDS: integer(900, 900),
    SESSION_TTL_SECONDS: integer(604800, 604800),
    AUTH_ALLOWED_ORIGINS: z.string().min(1),
    AUTH_RATE_WINDOW_SECONDS: integer(60, 3600),
    AUTH_LOGIN_LIMIT: integer(10, 100000),
    AUTH_REGISTER_LIMIT: integer(5, 100000),
    AUTH_REFRESH_LIMIT: integer(120, 100000),
    AUTH_PASSWORD_LIMIT: integer(5, 100000),
  }).safeParse(env)
  if (!parsed.success) throw new Error('Configuración de autenticación inválida: ' + parsed.error.issues.map(i => i.path.join('.')).join(', '))
  const config = parsed.data
  const origins = config.AUTH_ALLOWED_ORIGINS.split(',').map(v => v.trim())
  if (origins.some(value => {
    try { const url = new URL(value); return url.origin !== value || !['http:', 'https:'].includes(url.protocol) || (config.NODE_ENV === 'production' && url.protocol !== 'https:') }
    catch { return true }
  })) throw new Error('AUTH_ALLOWED_ORIGINS debe contener orígenes exactos HTTP(S); producción requiere HTTPS')
  return { ...config, origins }
}
export const authConfig = readAuthConfig(process.env)
