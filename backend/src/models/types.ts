export interface JwtPayload {
  userId: number
  email: string
  role: string
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload
}