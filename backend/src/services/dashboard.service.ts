import prisma from '../utils/prismaClient'

export const getDashboard = async (userId: number) => {
  // Proyectos activos del usuario
  const activeProjects = await prisma.project.findMany({
    where: {
      members: { some: { userId } },
      status: 'ACTIVE'
    },
    include: {
      _count: { select: { tasks: true } }
    }
  })

  // Mis tareas pendientes
  const myPendingTasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'COMPLETED' }
    },
    include: {
      project: { select: { id: true, name: true } }
    },
    orderBy: { dueDate: 'asc' },
    take: 5
  })

  // Tareas próximas a vencer (vista SQL)
  const upcomingTasks = await prisma.$queryRaw`
    SELECT * FROM upcoming_tasks
  `

  // Resumen general
  const totalProjects = await prisma.project.count({
    where: { members: { some: { userId } } }
  })

  const totalTasks = await prisma.task.count({
    where: { project: { members: { some: { userId } } } }
  })

  const completedTasks = await prisma.task.count({
    where: {
      project: { members: { some: { userId } } },
      status: 'COMPLETED'
    }
  })

  return {
    summary: {
      totalProjects,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks
    },
    activeProjects,
    myPendingTasks,
    upcomingTasks
  }
}

export const getProjectSummary = async (projectId: number) => {
  const result = await prisma.$queryRaw`
    SELECT * FROM get_project_summary(${projectId})
  `
  return result
}