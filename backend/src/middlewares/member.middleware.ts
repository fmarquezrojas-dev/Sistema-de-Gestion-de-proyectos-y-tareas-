import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { AppError } from './errorHandler';

export const isProjectMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    const projectId = Number(req.params.projectId || req.body.projectId);

    if (!projectId) throw new AppError(400, 'ID de proyecto requerido');

    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId }
      }
    });

    if (!membership) {
      throw new AppError(403, 'No tienes permiso para acceder a este proyecto');
    }

    // Opcional: Guardar el rol en el request por si lo necesitas luego
    (req as any).projectRole = membership.role;

    next();
  } catch (err) {
    next(err);
  }
};