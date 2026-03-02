import { Router } from 'express'
// 1. Importar updateStatus (que es como la nombramos en el controlador)
import { 
  getByProject, 
  getById, 
  create, 
  update, 
  updateStatus, // <--- Añadida esta importación
  remove, 
  getMyTasks,
  removeComment 
} from '../controllers/task.controller'
import { authenticate } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { z } from 'zod'
import { isProjectMember } from '../middlewares/member.middleware'
import { getComments, addComment } from '../controllers/task.controller' // Asegúrate de que existan

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

// 1. Tareas personales
router.get('/my-tasks', getMyTasks)

// 2. Rutas por Proyecto
router.get('/project/:projectId', isProjectMember, getByProject)
router.post('/project/:projectId', isProjectMember, validate(createSchema), create)

// 3. Rutas de tareas individuales
router.get('/:id', getById)
router.put('/:id', validate(updateSchema), update)
router.delete('/:id', remove)
router.get('/:id/comments', getComments)
router.post('/:id/comments', addComment)
router.delete('/:id/comments/:commentId', removeComment)

// 4. Actualización rápida de estado (NUEVA)
// Usamos .patch porque es una actualización parcial
router.patch('/:id/status', updateStatus) 

export default router