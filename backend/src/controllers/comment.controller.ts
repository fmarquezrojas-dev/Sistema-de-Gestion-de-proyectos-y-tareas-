import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMMENT_SELECT = {
  id: true,
  content: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      avatarColor: true,
      avatarUrl: true,
    }
  }
}

// GET /tasks/:taskId/comments
export const getComments = async (req: Request, res: Response) => {
  try {
    // SOLUCIÓN AL ERROR 2345: Forzamos el tipo a string usando String()
    const taskId = parseInt(String(req.params.taskId));
    
    const comments = await prisma.comment.findMany({
      where:   { taskId },
      select:  COMMENT_SELECT,
      orderBy: { createdAt: 'asc' },
    })
    return res.json({ data: comments })
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener comentarios' })
  }
}

// POST /tasks/:taskId/comments
export const createComment = async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(String(req.params.taskId));
    const userId = (req as any).user.id
    const { content } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío' })
    }

    const task = await prisma.task.findUnique({ 
      where: { id: taskId },
      select: { 
        title: true, 
        projectId: true,
        project: { select: { name: true } } 
      } 
    })

    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' })

    const comment = await prisma.comment.create({
      data: { content: content.trim(), taskId, userId },
      select: COMMENT_SELECT,
    })

    // Registrar en ActivityLog
    prisma.activityLog.create({
      data: {
        type: 'TASK_UPDATED',
        description: `Comentó en la tarea "${task.title}"`,
        userId,
        taskId,
        projectId:   task.projectId,
        taskTitle:   task.title,
        projectName: task.project?.name,
      }
    }).catch((err: any) => console.error("Log error:", err))

    return res.status(201).json({ data: comment })
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear comentario' })
  }
}

// DELETE /tasks/:taskId/comments/:commentId
export const deleteComment = async (req: Request, res: Response) => {
  try {
    // SOLUCIÓN AL ERROR 2345: Para el commentId también
    const commentId = parseInt(String(req.params.commentId));
    const userId    = (req as any).user.id

    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    
    if (!comment) return res.status(404).json({ error: 'Comentario no encontrado' })
    if (comment.userId !== userId) return res.status(403).json({ error: 'No autorizado' })

    await prisma.comment.delete({ where: { id: commentId } })
    
    return res.json({ message: 'Comentario eliminado' })
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar' })
  }
}