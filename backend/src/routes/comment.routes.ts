import { validate } from '../middlewares/validate'
import { commentBody, validateId } from '../middlewares/resourceValidation'
import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import { getComments, createComment, deleteComment } from '../controllers/comment.controller'

const router = Router({ mergeParams: true }) // para acceder a :taskId

router.get('/',             authenticate, getComments)
router.post('/',            authenticate, validate(commentBody), createComment)
router.delete('/:commentId', authenticate, validateId, deleteComment)

export default router
