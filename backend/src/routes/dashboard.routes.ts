import { Router } from 'express'
import { getDashboard, getProjectSummary } from '../controllers/dashboard.controller'
import { authenticate } from '../middlewares/authMiddleware'

const router = Router()

router.use(authenticate)

router.get('/', getDashboard)
router.get('/project/:projectId/summary', getProjectSummary)

export default router