import { z } from 'zod'
export const actorSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.number().int().positive(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER']),
})
export type JwtPayload = z.infer<typeof actorSchema>
declare global {
  namespace Express {
    interface Request { user?: JwtPayload }
  }
}
