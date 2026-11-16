import { RequestHandler } from 'express'
import * as service from '../services/task.service'
import { actorId } from '../middlewares/authMiddleware'
import { positiveId, taskFilters, historyQuery } from '../middlewares/resourceValidation'
export const getByProject: RequestHandler = async (req, res) => {
  res.json(await service.getTasksByProject(positiveId.parse(req.params.projectId), actorId(req), taskFilters.parse(req.query)))
}
export const getById: RequestHandler = async (req, res) => {
  res.json({ data: await service.getTaskById(positiveId.parse(req.params.id), actorId(req)) })
}
export const create: RequestHandler = async (req, res) => {
  res.status(201).json({ data: await service.createTask(positiveId.parse(req.params.projectId), actorId(req), req.body) })
}
export const update: RequestHandler = async (req, res) => {
  res.json({ data: await service.updateTask(positiveId.parse(req.params.id), actorId(req), req.body) })
}
export const updateStatus = update
export const remove: RequestHandler = async (req, res) => {
  await service.deleteTask(positiveId.parse(req.params.id), actorId(req), req.body.expectedVersion)
  res.json({ data: null, message: 'Tarea eliminada correctamente' })
}
export const getMyTasks: RequestHandler = async (req, res) => {
  res.json(await service.getMyTasks(actorId(req), taskFilters.parse(req.query)))
}

export const getHistory: RequestHandler = async (req, res) => {
  const { page, limit } = historyQuery.parse(req.query)
  res.json(await service.getTaskHistory(positiveId.parse(req.params.id), actorId(req), page, limit))
}
