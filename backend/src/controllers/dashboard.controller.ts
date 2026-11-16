import { RequestHandler } from 'express'
import { actorId } from '../middlewares/authMiddleware'
import { positiveId } from '../middlewares/resourceValidation'
import * as service from '../services/dashboard.service'
export const getDashboard: RequestHandler = async (req, res) => {
  res.json({ data: await service.getDashboard(actorId(req)) })
}
export const getProjectSummary: RequestHandler = async (req, res) => {
  res.json(await service.getProjectSummary(positiveId.parse(req.params.projectId), actorId(req)))
}
