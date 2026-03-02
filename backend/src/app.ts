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
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

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