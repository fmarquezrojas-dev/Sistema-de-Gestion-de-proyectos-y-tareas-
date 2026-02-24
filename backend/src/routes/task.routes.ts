import { Router } from 'express'
import { getByProject, getById, create, update, remove, getMyTasks } from '../controllers/task.controller'
import { authenticate } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { z } from 'zod'

const router = Router()

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  dueDate: z.string().optional(),
  assigneeId: z.number().optional()
})

const updateSchema = createSchema.partial()

router.use(authenticate)

router.get('/my-tasks', getMyTasks)
router.get('/project/:projectId', getByProject)
router.get('/:id', getById)
router.post('/project/:projectId', validate(createSchema), create)
router.put('/:id', validate(updateSchema), update)
router.delete('/:id', remove)

export default router