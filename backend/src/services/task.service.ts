import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { TaskStatus, Priority } from '@prisma/client'

export const getTasksByProject = async (
  projectId: number,
  userId: number,
  filters: { status?: TaskStatus; priority?: Priority; page?: number; limit?: number }
) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  })
  if (!member) throw new AppError(403, 'No tienes acceso a este proyecto')

  const page = filters.page || 1
  const limit = filters.limit || 10
  const skip = (page - 1) * limit

  const where = {
    projectId,
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority })
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
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
      id: taskId,
      project: { members: { some: { userId } } }
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } }
    }
  })

  if (!task) throw new AppError(404, 'Tarea no encontrada')
  return task
}

export const createTask = async (
  projectId: number,
  userId: number,
  body: {
    title: string
    description?: string
    priority?: Priority
    status?: TaskStatus
    dueDate?: string
    assigneeId?: number
  }
) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  })
  if (!member) throw new AppError(403, 'No tienes acceso a este proyecto')

  return prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      priority: body.priority || 'MEDIUM',
      status: body.status || 'PENDING',
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      assigneeId: body.assigneeId,
      projectId
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    }
  })
}

export const updateTask = async (
  taskId: number,
  userId: number,
  body: {
    title?: string
    description?: string
    priority?: Priority
    status?: TaskStatus
    dueDate?: string
    assigneeId?: number
  }
) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { members: { some: { userId } } }
    }
  })

  if (!task) throw new AppError(404, 'Tarea no encontrada')

  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined
    },
    include: {
      assignee: { select: { id: true, name: true, email: true } }
    }
  })
}

export const deleteTask = async (taskId: number, userId: number) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { members: { some: { userId } } }
    }
  })

  if (!task) throw new AppError(404, 'Tarea no encontrada')

  await prisma.task.delete({ where: { id: taskId } })
}

export const getMyTasks = async (userId: number) => {
  return prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'COMPLETED' }
    },
    include: {
      project: { select: { id: true, name: true } }
    },
    orderBy: { dueDate: 'asc' }
  })
}