import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { TaskStatus, Priority } from '@prisma/client'
import { logActivity } from '../utils/logActivity'
import axios from 'axios'

/**
 * HELPER: Envía una alerta al microservicio de Python (FastAPI)
 * No bloquea el flujo principal si el servicio de notificaciones está caído.
 */
const notifyAssignment = async (task: any, assignee: any, projectName?: string) => {
  if (!process.env.NOTIFICATION_SERVICE_URL || !assignee?.email) return
  
  try {
    await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/notify/task-alert`, {
      user_email:   assignee.email,
      user_name:    assignee.name,
      task_title:   task.title,
      task_id:      task.id,
      project_name: projectName || task.project?.name,
      due_date:     task.dueDate ? new Date(task.dueDate).toISOString() : null,
      alert_type:   'assigned',
    }, { timeout: 3000 })
    console.log(`[Notifications] Alerta enviada a ${assignee.email}`)
  } catch (err) {
    console.warn('[Notifications] El microservicio Python no respondió (posiblemente apagado)')
  }
}

export const getTasksByProject = async (
  projectId: number,
  userId: number,
  filters: { status?: TaskStatus; priority?: Priority; page?: number; limit?: number }
) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  })
  if (!member) throw new AppError(403, 'No tienes acceso a este proyecto')

  const page  = filters.page  || 1
  const limit = filters.limit || 50 
  const skip  = (page - 1) * limit

  const where = {
    projectId,
    ...(filters.status   && { status:   filters.status   }),
    ...(filters.priority && { priority: filters.priority })
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } }
      },
      orderBy: [
        { status:    'asc'  },
        { dueDate:   'asc'  },
        { createdAt: 'desc' }
      ],
      skip,
      take: limit
    }),
    prisma.task.count({ where })
  ])

  return { data: tasks, total, page, limit }
}

export const getTaskById = async (taskId: number, userId: number) => {
  const task = await prisma.task.findFirst({
    where: {
      id:      taskId,
      project: { members: { some: { userId } } }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true, avatarColor: true } },
      project:  { select: { id: true, name: true } }
    }
  })
  if (!task) throw new AppError(404, 'Tarea no encontrada')
  return task
}

export const createTask = async (
  projectId: number,
  userId: number,
  body: {
    title:        string
    description?: string
    priority?:     Priority
    status?:       TaskStatus
    dueDate?:      string
    assigneeId?:   number
  }
) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: { select: { name: true } } }
  })
  
  if (!member) throw new AppError(403, 'No tienes acceso a este proyecto')

  const newTask = await prisma.task.create({
    data: {
      title:       body.title,
      description: body.description,
      priority:    body.priority  || 'MEDIUM',
      status:      body.status    || 'PENDING',
      dueDate:     body.dueDate   ? new Date(body.dueDate) : undefined,
      assigneeId:  body.assigneeId,
      projectId
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    }
  })

  // 1. Log de Actividad
  await logActivity({
    type:         'TASK_CREATED',
    description:  `Creó la tarea "${newTask.title}"`,
    userId,
    projectId,
    taskId:       newTask.id,
    taskTitle:    newTask.title,
    projectName:  member.project.name,
  }).catch(() => {})

  // 2. Notificación (Microservicio Python)
  if (newTask.assigneeId && newTask.assignee) {
    notifyAssignment(newTask, newTask.assignee, member.project.name)
  }

  return newTask
}

export const updateTask = async (
  taskId: number,
  userId: number,
  body: {
    title?:       string
    description?: string
    priority?:     Priority
    status?:       TaskStatus
    dueDate?:      string
    assigneeId?:   number
  }
) => {
  const task = await prisma.task.findFirst({
    where: {
      id:      taskId,
      project: { members: { some: { userId } } }
    },
    include: { project: { select: { name: true } } }
  })
  
  if (!task) throw new AppError(404, 'Tarea no encontrada')

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title       !== undefined && { title:       body.title       }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.priority    !== undefined && { priority:    body.priority    }),
      ...(body.status      !== undefined && { status:      body.status      }),
      ...(body.assigneeId  !== undefined && { assigneeId:  body.assigneeId  }),
      ...(body.dueDate     !== undefined && { dueDate:     new Date(body.dueDate) })
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    }
  })

  // 1. Log de Actividad
  if (body.status === 'COMPLETED' && task.status !== 'COMPLETED') {
    await logActivity({
      type:        'TASK_COMPLETED',
      description: `Completó la tarea "${updatedTask.title}"`,
      userId,
      projectId:   task.projectId,
      taskId:      task.id,
      taskTitle:   updatedTask.title,
      projectName: task.project.name
    }).catch(() => {})
  } else {
    await logActivity({
      type:        'TASK_UPDATED',
      description: `Actualizó la tarea "${updatedTask.title}"`,
      userId,
      projectId:   task.projectId,
      taskId:      task.id,
      taskTitle:   updatedTask.title,
      projectName: task.project.name
    }).catch(() => {})
  }

  // 2. Notificación si el asignado cambió
  if (body.assigneeId && body.assigneeId !== (task as any).assigneeId) {
    notifyAssignment(updatedTask, updatedTask.assignee, task.project.name)
  }

  return updatedTask
}

export const deleteTask = async (taskId: number, userId: number) => {
  const task = await prisma.task.findFirst({
    where: {
      id:      taskId,
      project: { members: { some: { userId } } }
    }
  })
  if (!task) throw new AppError(404, 'Tarea no encontrada')
  
  await prisma.task.delete({ where: { id: taskId } })
}

export const getMyTasks = async (userId: number) => {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: userId },
    include: {
      project: { select: { id: true, name: true } }
    },
    orderBy: [
      { status:  'asc' },
      { dueDate: 'asc' }
    ]
  })

  const now = new Date()
  return tasks.map(task => ({
    ...task,
    isOverdue: !!(
      task.dueDate &&
      task.status !== 'COMPLETED' &&
      new Date(task.dueDate) < now
    )
  }))
}