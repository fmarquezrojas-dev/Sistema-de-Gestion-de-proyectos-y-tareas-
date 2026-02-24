import { Request, Response, NextFunction } from 'express'
import * as taskService from '../services/task.service'
import { TaskStatus, Priority } from '@prisma/client'

export const getByProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const projectId = Number(req.params.projectId)
    const { status, priority, page, limit } = req.query

    const result = await taskService.getTasksByProject(projectId, userId, {
      status: status as TaskStatus,
      priority: priority as Priority,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    })

    res.json(result)
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const task = await taskService.getTaskById(Number(req.params.id), userId)
    res.json({ data: task })
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const projectId = Number(req.params.projectId)
    const task = await taskService.createTask(projectId, userId, req.body)
    res.status(201).json({ data: task })
  } catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const task = await taskService.updateTask(Number(req.params.id), userId, req.body)
    res.json({ data: task })
  } catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    await taskService.deleteTask(Number(req.params.id), userId)
    res.json({ data: null, message: 'Tarea eliminada correctamente' })
  } catch (err) { next(err) }
}

export const getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const tasks = await taskService.getMyTasks(userId)
    res.json({ data: tasks })
  } catch (err) { next(err) }
}