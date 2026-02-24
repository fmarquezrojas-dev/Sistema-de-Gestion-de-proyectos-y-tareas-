import { Router } from 'express'
import { register, login, refreshToken, logout } from '../controllers/auth.controller'
import { validate } from '../middlewares/validate'
import { z } from 'zod'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.post('/refresh', refreshToken)
router.post('/logout', logout)

export default router