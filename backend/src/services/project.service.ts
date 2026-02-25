import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { ProjectStatus } from '@prisma/client'

export const getAllProjects = async (userId: number) => {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { tasks: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export const getProjectById = async (projectId: number, userId: number) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } }
      },
      tasks: {
        include: { assignee: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!project) throw new AppError(404, 'Proyecto no encontrado')
  return project
}

export const createProject = async (userId: number, body: { name: string; description?: string }) => {
  return prisma.project.create({
    data: {
      name: body.name,
      description: body.description,
      members: {
        create: { userId, role: 'OWNER' }
      }
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } }
    }
  })
}

export const updateProject = async (
  projectId: number,
  userId: number,
  body: { name?: string; description?: string; status?: ProjectStatus }
) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } }
  })

  if (!project) throw new AppError(404, 'Proyecto no encontrado')

  return prisma.project.update({
    where: { id: projectId },
    data: body
  })
}

export const deleteProject = async (projectId: number, userId: number) => {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  })

  if (!member) throw new AppError(404, 'Proyecto no encontrado')
  if (member.role !== 'OWNER') throw new AppError(403, 'Solo el dueño puede eliminar el proyecto')

  await prisma.project.delete({ where: { id: projectId } })
}

export const addMember = async (projectId: number, memberEmail: string, userId: number) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } }
  })

  if (!project) throw new AppError(404, 'Proyecto no encontrado')

  const userToAdd = await prisma.user.findUnique({ where: { email: memberEmail } })
  if (!userToAdd) throw new AppError(404, 'Usuario no encontrado')

  const alreadyMember = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: userToAdd.id, projectId } }
  })

  if (alreadyMember) throw new AppError(409, 'El usuario ya es miembro del proyecto')

  return prisma.projectMember.create({
    data: {
      userId: userToAdd.id,
      projectId,
      role: 'MEMBER' // ← fix principal
    }
  })
}

export const removeMember = async (projectId: number, memberId: number, userId: number) => {
  const requester = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  })

  if (!requester) throw new AppError(404, 'Proyecto no encontrado')

  // ✅ Puede quitar si es Owner O si se está retirando a sí mismo
  const isSelf = memberId === userId
  if (!isSelf && requester.role !== 'OWNER') {
    throw new AppError(403, 'Solo el dueño puede quitar otros miembros')
  }

  // Owner no puede abandonar su propio proyecto
  if (isSelf && requester.role === 'OWNER') {
    throw new AppError(400, 'El dueño no puede abandonar el proyecto. Elimínalo si ya no lo necesitas.')
  }

  await prisma.projectMember.delete({
    where: { userId_projectId: { userId: memberId, projectId } }
  })
}