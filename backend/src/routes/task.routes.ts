import { Router } from 'express'
import { getByProject, getById, create, update, remove, getMyTasks } from '../controllers/task.controller'
import { authenticate } from '../middlewares/authMiddleware' // Usando tu import original
import { validate } from '../middlewares/validate'
import { z } from 'zod'
import { isProjectMember } from '../middlewares/member.middleware'

const router = Router()

// Esquemas de validación (Zod)
const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.number().optional()
})

const updateSchema = createSchema.partial()

// Todas las rutas de tareas requieren estar logueado
router.use(authenticate)

// 1. Obtener tareas globales del usuario logueado
router.get('/my-tasks', getMyTasks)

// 2. Rutas que dependen de un Proyecto (Requieren verificar membresía)
// Aplicamos isProjectMember porque el projectId viene en la URL
router.get('/project/:projectId', isProjectMember, getByProject)
router.post('/project/:projectId', isProjectMember, validate(createSchema), create)

// 3. Rutas de tareas individuales
// Aquí la seguridad se maneja usualmente dentro del controlador validando que el userId sea el dueño/asignado
router.get('/:id', getById)
router.put('/:id', validate(updateSchema), update)
router.delete('/:id', remove)

export default router