// backend/src/utils/logActivity.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface LogData {
  type:         string
  description:  string
  userId:       number
  projectId?:   number
  taskId?:      number
  taskTitle?:   string
  taskStatus?:  string
  taskPriority?: string
  projectName?: string
}

export const logActivity = async (data: LogData): Promise<void> => {
  try {
    await prisma.activityLog.create({ data })
  } catch (err) {
    // Silencioso — el log no debe interrumpir la operación principal
    console.warn('[ActivityLog] Error al registrar actividad:', err)
  }
}