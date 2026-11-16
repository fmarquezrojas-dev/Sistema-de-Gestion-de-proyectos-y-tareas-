import { unassignTasks } from './taskHistory'
import { requireMember, requireOwner, transaction } from './projectAccess';
import prisma from "../utils/prismaClient";
import { AppError } from "../middlewares/errorHandler";
import { ProjectStatus } from "@prisma/client";

export const getAllProjects = async (userId: number) => {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true } } }
      },
      _count: { select: { tasks: true } },
      // ✅ Traer tasks con status para calcular progreso
      tasks: {
        select: { id: true, status: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const getProjectById = async (projectId: number, userId: number) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatarColor: true,
              avatarUrl: true,
            }, // ← agrega avatarColor
          },
        },
      },
      tasks: {
        include: {
          assignee: {
            select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true },
          }, // ← agrega avatarColor
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project) throw new AppError(404, "Proyecto no encontrado");
  return project;
};


export const createProject = (userId: number, body: { name: string; description?: string | null }) => transaction(async db => {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(401, 'La cuenta ya no existe')
  return db.project.create({
    data: { ...body, members: { create: { userId, role: 'OWNER' } } },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  })
})
export const updateProject = (projectId: number, userId: number, body: { name?: string; description?: string | null; status?: ProjectStatus }) => transaction(async db => {
  requireOwner(await requireMember(db, projectId, userId))
  return db.project.update({ where: { id: projectId }, data: body })
})
export const deleteProject = (projectId: number, userId: number) => transaction(async db => {
  requireOwner(await requireMember(db, projectId, userId))
  await db.project.delete({ where: { id: projectId } })
})
export const addMember = (projectId: number, email: string, userId: number) => transaction(async db => {
  requireOwner(await requireMember(db, projectId, userId))
  const user = await db.user.findUnique({ where: { email } })
  if (!user) throw new AppError(404, 'Usuario no encontrado')
  const existing = await db.projectMember.findUnique({ where: { userId_projectId: { userId: user.id, projectId } } })
  if (existing) throw new AppError(409, 'El usuario ya es miembro del proyecto')
  return db.projectMember.create({ data: { userId: user.id, projectId, role: 'MEMBER' } })
})
export const removeMember = (projectId: number, memberId: number, userId: number) => transaction(async db => {
  const requester = await requireMember(db, projectId, userId)
  if (memberId !== userId) requireOwner(requester)
  const target = await requireMember(db, projectId, memberId)
  if (target.role === 'OWNER') throw new AppError(409, 'No se puede retirar a un propietario. La transferencia de propiedad aún no está disponible')
  await unassignTasks(db, memberId, userId, 'MEMBER_REMOVED', projectId)
  await db.projectMember.delete({ where: { userId_projectId: { userId: memberId, projectId } } })
})
export const updateMemberPermissions = (projectId: number, memberId: number, userId: number, data: { canCreateTasks: boolean; canEditTasks: boolean }) => transaction(async db => {
  requireOwner(await requireMember(db, projectId, userId))
  const target = await requireMember(db, projectId, memberId)
  if (target.role === 'OWNER') throw new AppError(409, 'El propietario siempre tiene todos los permisos')
  return db.projectMember.update({ where: { userId_projectId: { userId: memberId, projectId } }, data })
})
