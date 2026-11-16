import internalRoutes from './routes/internal.routes'
import prisma from './utils/prismaClient'
import { authConfig } from './config/auth'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middlewares/errorHandler'
import authRoutes from './routes/auth.routes'
import projectRoutes from './routes/project.routes'
import taskRoutes from './routes/task.routes'
import dashboardRoutes from './routes/dashboard.routes'

const app = express()

// Middlewares globales
app.set('trust proxy', false)
app.use('/api/internal', internalRoutes)
app.get('/health/live', (_req, res) => { res.json({ status: 'alive' }) })
app.get('/health/ready', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }) }
  catch { res.status(503).json({ status: 'unavailable' }) }
})
app.use(cors({ origin: authConfig.origins, credentials: true }))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

app.use(cookieParser())


// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/dashboard', dashboardRoutes)
// Manejo de errores (siempre al final)
app.use(errorHandler)

export default app