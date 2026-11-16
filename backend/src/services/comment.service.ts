import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { requireTask, transaction } from './projectAccess'
const include = { user: { select: { id: true, name: true, avatarUrl: true, avatarColor: true } } } as const
export const getComments = async (taskId: number, userId: number) => {
  await requireTask(prisma, taskId, userId)
  return prisma.comment.findMany({ where: { taskId, task: { project: { members: { some: { userId } } } } }, include, orderBy: { createdAt: 'desc' } })
}
export const createComment = (taskId: number, userId: number, content: string) => transaction(async db => {
  await requireTask(db, taskId, userId)
  return db.comment.create({ data: { taskId, userId, content }, include })
})
export const deleteComment = (taskId: number, commentId: number, userId: number) => transaction(async db => {
  const { member } = await requireTask(db, taskId, userId)
  const comment = await db.comment.findFirst({ where: { id: commentId, taskId } })
  if (!comment) throw new AppError(404, 'Comentario no encontrado')
  if (comment.userId !== userId && member.role !== 'OWNER') throw new AppError(403, 'Solo puedes eliminar tus comentarios')
  await db.comment.delete({ where: { id: commentId } })
})
