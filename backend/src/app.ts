import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middlewares/errorHandler'
import authRoutes from './routes/auth.routes'
import projectRoutes from './routes/project.routes'
import taskRoutes from './routes/task.routes'

const app = express()

// Middlewares globales
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/tasks', taskRoutes)
// Manejo de errores (siempre al final)
app.use(errorHandler)

export default app