import { RequestHandler } from 'express'
import { z } from 'zod'
export const positiveId = z.coerce.number().int().positive().max(2147483647)
export const taskStatus = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'])
export const taskBody = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(10000).nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: taskStatus.optional(),
  dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
  assigneeId: z.number().int().positive().max(2147483647).nullable().optional(),
}).strict()
export type TaskInput = z.infer<typeof taskBody>
export const taskFilters = z.object({
  status: taskStatus.optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  page: positiveId.max(1000000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().trim().max(200).optional(),
})
export type TaskFilters = z.infer<typeof taskFilters>
export const commentBody = z.object({ content: z.string().trim().min(1).max(5000) }).strict()
export const validateId: RequestHandler = (req, _res, next) => {
  try { Object.values(req.params).forEach(value => positiveId.parse(value)); next() } catch (error) { next(error) }
}

export const expectedVersion = z.number().int().positive().max(2147483647)
export const updateTaskBody = taskBody.partial().extend({ expectedVersion }).strict()
export type TaskUpdateInput = z.infer<typeof updateTaskBody>
export const deleteTaskBody = z.object({ expectedVersion }).strict()
export const historyQuery = z.object({
  page: positiveId.max(1000000).default(1),
  limit: positiveId.max(50).default(20),
}).strict()
