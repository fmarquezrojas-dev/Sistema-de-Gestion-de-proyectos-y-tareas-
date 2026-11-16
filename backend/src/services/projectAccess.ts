import { Prisma, ProjectMember } from '@prisma/client'
import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
export type Database = Prisma.TransactionClient
export async function requireMember(db: Database, projectId: number, userId: number) {
  const member = await db.projectMember.findUnique({ where: { userId_projectId: { userId, projectId } } })
  if (!member) throw new AppError(404, 'Proyecto no encontrado o sin acceso')
  return member
}
export function requireOwner(member: ProjectMember) {
  if (member.role !== 'OWNER') throw new AppError(403, 'Solo el propietario puede realizar esta acción')
}
export function requireTaskPermission(member: ProjectMember, permission: 'canCreateTasks' | 'canEditTasks') {
  if (member.role !== 'OWNER' && !member[permission])
    throw new AppError(403, permission === 'canCreateTasks' ? 'No tienes permiso para crear tareas' : 'No tienes permiso para editar tareas')
}
export async function requireTask(db: Database, taskId: number, userId: number) {
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) throw new AppError(404, 'Tarea no encontrada o sin acceso')
  const member = await requireMember(db, task.projectId, userId)
  return { task, member }
}
export async function requireAssignee(db: Database, projectId: number, assigneeId?: number | null) {
  if (assigneeId == null) return
  const member = await db.projectMember.findUnique({ where: { userId_projectId: { userId: assigneeId, projectId } } })
  if (!member) throw new AppError(400, 'El responsable debe ser miembro actual del proyecto')
}
// Todas las mutaciones colaborativas participan en el mismo aislamiento.
// PostgreSQL detecta el ciclo lectura/escritura entre asignación y retiro.
export async function transaction<T>(work: (db: Database) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      // Los bloqueos SQL explícitos reportan SQLSTATE mediante P2010.
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' ||
        (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) {
        if (attempt < 3) continue
        throw new AppError(409, 'El proyecto cambió simultáneamente. Vuelve a intentarlo')
      }
      throw error
    }
  }
}
