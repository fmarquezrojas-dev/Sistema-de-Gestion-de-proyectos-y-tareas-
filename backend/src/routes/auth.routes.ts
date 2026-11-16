import { authConfig as config } from '../config/auth'
import { requireOrigin, rateLimit } from '../middlewares/sessionSecurity'
import { Router } from 'express'
// ✅ Se añaden los nuevos controladores: updateAvatarController y removeAvatarController
import {
  register,
  login,
  refreshToken,
  logout,
  updateProfile,
  changePassword,
  getProfileStats,
  getProfile,
  deleteAccount,
  searchUsers,
  updateAvatarController,
  removeAvatarController
} from '../controllers/auth.controller'
import { validate } from '../middlewares/validate'
import { authenticate } from '../middlewares/authMiddleware'
// ✅ Se añaden los nuevos middlewares de subida
import { uploadAvatar, handleUploadError } from '../middlewares/uploadMiddleware'
import { z } from 'zod'

const router = Router()
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
const newPassword = z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Máximo 72 bytes')


const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: newPassword
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200)
})

// Rutas existentes
router.post('/register', requireOrigin, rateLimit(config.AUTH_REGISTER_LIMIT), validate(registerSchema), register)
router.post('/login', requireOrigin, rateLimit(config.AUTH_LOGIN_LIMIT), validate(loginSchema), login)
router.get('/me', authenticate, getProfile)
router.get('/profile/stats', authenticate, getProfileStats)
router.get('/users/search', authenticate, searchUsers)
router.post('/refresh', requireOrigin, rateLimit(config.AUTH_REFRESH_LIMIT), refreshToken)
router.post('/logout', requireOrigin, logout)
router.put('/profile', authenticate, updateProfile)
router.put('/password', requireOrigin, rateLimit(config.AUTH_PASSWORD_LIMIT), authenticate, validate(z.object({ currentPassword: z.string().min(1).max(200), newPassword }).strict()), changePassword)
router.delete('/account', authenticate, validate(z.object({ password: z.string().min(1).max(200) }).strict()), deleteAccount)

// ✅ Rutas de Avatar (Cloudinary)
// PATCH: Sube o actualiza la foto. Primero autentica, luego procesa el archivo, maneja errores de Multer y finalmente sube a la nube.
router.patch('/profile/avatar', authenticate, uploadAvatar, handleUploadError, updateAvatarController);

// DELETE: Borra la foto actual.
router.delete('/profile/avatar', authenticate, removeAvatarController);

export default router
