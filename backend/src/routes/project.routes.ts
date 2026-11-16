import { validateId } from '../middlewares/resourceValidation'
import { Router } from 'express'
import { getAll, getById, create, update, remove, addMember, removeMember, updateMemberPermissions } from '../controllers/project.controller'
import { authenticate } from '../middlewares/authMiddleware'
import { validate } from '../middlewares/validate'
import { z } from 'zod'

const router = Router()

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().max(10000).nullable().optional()
}).strict()

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']).optional()
}).strict()

const memberSchema = z.object({
  email: z.string().email()
}).strict()

const permissionsSchema = z.object({
  canCreateTasks: z.boolean(),
  canEditTasks: z.boolean()
}).strict()

router.use(authenticate)

router.get('/', getAll)
router.get('/:id', validateId, getById)
router.post('/', validate(createSchema), create)
router.put('/:id', validateId, validate(updateSchema), update)
router.delete('/:id', validateId, remove)
router.post('/:id/members', validateId, validate(memberSchema), addMember)
router.delete('/:id/members/:memberId', validateId, removeMember)
router.patch('/:id/members/:userId/permissions', validateId, validate(permissionsSchema), updateMemberPermissions)

export default router