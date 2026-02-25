import { Request, Response, NextFunction } from 'express'
import * as dashboardService from '../services/dashboard.service'

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const data = await dashboardService.getDashboard(userId)
    res.json({ data })
  } catch (err) { next(err) }
}

export const getProjectSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await dashboardService.getProjectSummary(Number(req.params.projectId))
    res.json(data)
  } catch (err) { next(err) }
}