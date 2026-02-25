import { Router } from 'express'
import { register, login, refreshToken, logout, updateProfile, changePassword } from '../controllers/auth.controller'
import { validate } from '../middlewares/validate'
import { authenticate } from '../middlewares/authMiddleware'
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
router.put('/profile', authenticate, updateProfile)
router.put('/password', authenticate, changePassword)

export default router