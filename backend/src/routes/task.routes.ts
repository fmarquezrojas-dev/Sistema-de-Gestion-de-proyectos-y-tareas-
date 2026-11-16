import { Router } from 'express'
import * as controller from '../controllers/task.controller'
import { authenticate } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { taskBody, taskStatus, validateId, expectedVersion, updateTaskBody, deleteTaskBody } from '../middlewares/resourceValidation'
import { z } from 'zod'
import commentRoutes from './comment.routes'
const router = Router()
router.use(authenticate)
router.get('/my-tasks', controller.getMyTasks)
router.get('/project/:projectId', validateId, controller.getByProject)
router.post('/project/:projectId', validateId, validate(taskBody), controller.create)
router.use('/:taskId/comments', validateId, commentRoutes)
router.get('/:id/activity', validateId, controller.getHistory)
router.get('/:id', validateId, controller.getById)
router.put('/:id', validateId, validate(updateTaskBody), controller.update)
router.patch('/:id/status', validateId, validate(z.object({ status: taskStatus, expectedVersion }).strict()), controller.updateStatus)
router.delete('/:id', validateId, validate(deleteTaskBody), controller.remove)
export default router
