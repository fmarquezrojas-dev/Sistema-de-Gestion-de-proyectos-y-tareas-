import { Router } from 'express'
import { getAll, getById, create, update, remove, addMember, removeMember } from '../controllers/project.controller'
import { authenticate } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { z } from 'zod'

const router = Router()

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional()
})

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional()
})

const memberSchema = z.object({
  email: z.string().email()
})

router.use(authenticate)

router.get('/', getAll)
router.get('/:id', getById)
router.post('/', validate(createSchema), create)
router.put('/:id', validate(updateSchema), update)
router.delete('/:id', remove)
router.post('/:id/members', validate(memberSchema), addMember)
router.delete('/:id/members/:memberId', removeMember)

export default router