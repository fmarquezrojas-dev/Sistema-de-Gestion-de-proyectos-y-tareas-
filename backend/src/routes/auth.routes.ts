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

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

// Rutas existentes
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.get('/profile/stats', authenticate, getProfileStats)
router.get('/users/search', authenticate, searchUsers)
router.post('/refresh', refreshToken)
router.post('/logout', logout)
router.put('/profile', authenticate, updateProfile)
router.put('/password', authenticate, changePassword)
router.delete('/account', authenticate, deleteAccount)

// ✅ Rutas de Avatar (Cloudinary)
// PATCH: Sube o actualiza la foto. Primero autentica, luego procesa el archivo, maneja errores de Multer y finalmente sube a la nube.
router.patch('/profile/avatar', authenticate, uploadAvatar, handleUploadError, updateAvatarController);

// DELETE: Borra la foto actual.
router.delete('/profile/avatar', authenticate, removeAvatarController);

export default router