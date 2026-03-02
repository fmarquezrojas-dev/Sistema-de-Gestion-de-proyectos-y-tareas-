import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import { getComments, createComment, deleteComment } from '../controllers/comment.controller'

const router = Router({ mergeParams: true }) // para acceder a :taskId

router.get('/',             authenticate, getComments)
router.post('/',            authenticate, createComment)
router.delete('/:commentId', authenticate, deleteComment)

export default router

// En tu app.ts/server.ts:
// app.use('/api/tasks/:taskId/comments', commentRouter)