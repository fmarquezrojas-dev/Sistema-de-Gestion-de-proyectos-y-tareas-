import { Request, Response, NextFunction } from 'express'
import * as projectService from '../services/project.service'


export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const projects = await projectService.getAllProjects(userId)
    res.json({ data: projects })
  } catch (err) { next(err) }
}

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const project = await projectService.getProjectById(Number(req.params.id), userId)
    res.json({ data: project })
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const project = await projectService.createProject(userId, req.body)
    res.status(201).json({ data: project })
  } catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const project = await projectService.updateProject(Number(req.params.id), userId, req.body)
    res.json({ data: project })
  } catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    await projectService.deleteProject(Number(req.params.id), userId)
    res.json({ data: null, message: 'Proyecto eliminado correctamente' })
  } catch (err) { next(err) }
}

export const addMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const result = await projectService.addMember(Number(req.params.id), req.body.email, userId)
    res.status(201).json({ data: result })
  } catch (err) { next(err) }
}

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    await projectService.removeMember(Number(req.params.id), Number(req.params.memberId), userId)
    res.json({ data: null, message: 'Miembro eliminado correctamente' })
  } catch (err) { next(err) }
}

export const updateMemberPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = (req as any).user.userId
    const projectId = Number(req.params.id)
    const memberId = Number(req.params.userId)
    
    const result = await projectService.updateMemberPermissions(
      projectId,
      memberId,
      adminId,
      req.body
    )
    
    res.json({ data: result, message: 'Permisos actualizados correctamente' })
  } catch (err) { 
    next(err) 
  }
}