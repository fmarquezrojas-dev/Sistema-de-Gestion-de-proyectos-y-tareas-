import { RequestHandler } from 'express'
import { actorId } from '../middlewares/authMiddleware'
import { positiveId } from '../middlewares/resourceValidation'
import * as service from '../services/comment.service'
export const getComments: RequestHandler = async (req, res) => {
  res.json({ data: await service.getComments(positiveId.parse(req.params.taskId), actorId(req)) })
}
export const createComment: RequestHandler = async (req, res) => {
  res.status(201).json({ data: await service.createComment(positiveId.parse(req.params.taskId), actorId(req), req.body.content) })
}
export const deleteComment: RequestHandler = async (req, res) => {
  await service.deleteComment(positiveId.parse(req.params.taskId), positiveId.parse(req.params.commentId), actorId(req))
  res.json({ message: 'Comentario eliminado correctamente' })
}
