import { Request, Response, NextFunction } from 'express'
import * as taskService from '../services/task.service'
import { TaskStatus, Priority } from '@prisma/client'
import prisma from '../utils/prismaClient' // O la ruta donde tengas configurado el PrismaClient

// Tip auxiliar para no repetir el cast de userId
const getUserId = (req: Request) => (req as any).user?.userId || (req as any).user?.id;

export const getByProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
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
    const userId = getUserId(req);
    const task = await taskService.getTaskById(Number(req.params.id), userId)
    res.json({ data: task })
  } catch (err) { next(err) }
}

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const projectId = Number(req.params.projectId)
    // El SERVICE ya se encarga de logActivity
    const task = await taskService.createTask(projectId, userId, req.body)
    res.status(201).json({ data: task })
  } catch (err) { next(err) }
}

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    // El SERVICE ya se encarga de logActivity (detecta si se completó o solo se editó)
    const task = await taskService.updateTask(Number(req.params.id), userId, req.body)
    res.json({ data: task })
  } catch (err) { next(err) }
}

// NUEVA FUNCIÓN: Específica para cambiar el estado rápidamente (Drag & Drop o Checkbox)
export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const taskId = Number(req.params.id);
    const { status } = req.body;

    const VALID_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    // Reutilizamos el service.updateTask porque él ya maneja el logActivity de TASK_COMPLETED
    const task = await taskService.updateTask(taskId, userId, { status });
    
    res.json({ data: task });
  } catch (err) { next(err) }
}

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    await taskService.deleteTask(Number(req.params.id), userId)
    res.json({ data: null, message: 'Tarea eliminada correctamente' })
  } catch (err) { next(err) }
}

export const getMyTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    
    // Configuración de paginación
    const page  = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const skip  = (page - 1) * limit;

    const { status, priority, search } = req.query;

    // Construcción dinámica del filtro 'where'
    const where: any = {
      assigneeId: userId,
      ...(status   && { status:   status as TaskStatus }),
      ...(priority && { priority: priority as Priority }),
      ...(search   && {
        title: { contains: search as string, mode: 'insensitive' }
      }),
    };

    // Ejecución paralela para rendimiento (Data + Conteo Total)
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take:    limit,
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        include: {
          project:  { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } },
        }
      }),
      prisma.task.count({ where }),
    ]);

    // Respuesta con objeto de paginación (Vital para el Frontend)
    return res.json({
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      }
    });
  } catch (err) { next(err); }
}

// --- FUNCIONES DE COMENTARIOS ---

export const getComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskId = Number(req.params.id);

    // Buscamos los comentarios en la base de datos
    const comments = await prisma.comment.findMany({
      where: { taskId: taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
};

export const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const taskId = Number(req.params.id);
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'El contenido del comentario es requerido' });
    }

    // Creamos el comentario
    const newComment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            avatarColor: true
          }
        }
      }
    });

    
    // Opcional: Podrías llamar a un servicio aquí para registrar la actividad
    // await taskService.logActivity(taskId, userId, 'COMMENT_ADDED', `Añadió un comentario`);

    res.status(201).json({ data: newComment });
  } catch (err) {
    next(err);
  }
};


export const removeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const userId = getUserId(req);

    // 1. Primero verificamos si el comentario existe y si pertenece al usuario (Seguridad)
    const comment = await prisma.comment.findUnique({
      where: { id: Number(commentId) }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    // Opcional: Solo el que creó el comentario puede borrarlo
    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este comentario' });
    }

    await prisma.comment.delete({
      where: { id: Number(commentId) }
    });

    res.status(200).json({ message: 'Comentario eliminado correctamente' });
  } catch (err) {
    next(err);
  }
};