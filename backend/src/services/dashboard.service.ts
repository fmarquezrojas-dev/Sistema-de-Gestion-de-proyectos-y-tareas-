import prisma from '../utils/prismaClient'

/**
 * Obtiene todos los datos globales para el Dashboard del usuario.
 * Incluye: Resumen estadístico, Proyectos activos, Tareas vencidas,
 * Actividad reciente de sus proyectos y Tareas próximas a vencer.
 */
export const getDashboard = async (userId: number) => {
  // 1. Obtener los IDs de los proyectos donde el usuario es miembro
  // Esto es vital para filtrar la actividad reciente de sus equipos.
  const userProjects = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true }
  })
  const userProjectIds = userProjects.map(p => p.projectId)

  // 2. Consultar proyectos activos del usuario
  const activeProjects = await prisma.project.findMany({
    where: { 
      members: { some: { userId } }, 
      status: 'ACTIVE' 
    },
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { status: true } }
    }
  })

  // 3. Consultar tareas ya VENCIDAS (Fecha menor a "ahora")
  const overdueTasksList = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'COMPLETED' },
      dueDate: { lt: new Date() }
    },
    include: { project: { select: { id: true, name: true } } },
    orderBy: { dueDate: 'asc' }
  })

  // 4. Consultar TAREAS PRÓXIMAS A VENCER (Paso Crítico para Ivana)
  // Definimos un margen de 15 días para capturar tareas de hoy y de inicios de marzo.
  const upcomingTasksList = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'COMPLETED' },
      dueDate: {
        gte: new Date(), // Desde este momento
        lte: new Date(new Date().getTime() + 15 * 24 * 60 * 60 * 1000) // Próximos 15 días
      }
    },
    include: { 
      project: { select: { id: true, name: true } },
      assignee: { select: { name: true, avatarUrl: true, avatarColor: true } }
    },
    orderBy: { dueDate: 'asc' },
    take: 10
  })

  // 5. Consultar ACTIVIDAD RECIENTE (Actividad propia y de compañeros de equipo)
  const recentActivity = await prisma.activityLog.findMany({
    where: {
      OR: [
        { userId: userId },
        { projectId: { in: userProjectIds } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, 
      type: true, 
      description: true, 
      createdAt: true,
      taskTitle: true, 
      taskStatus: true, 
      taskPriority: true, 
      projectName: true,
      user: { 
        select: { 
          name: true, 
          avatarUrl: true, 
          avatarColor: true
        } 
      },
    }
  })

  // 6. Estadísticas Globales (Summary)
  const projectFilter = { project: { members: { some: { userId } } } };
  const [totalProjects, totalTasks, completedTasks, inProgressTasks, pendingTasks] = await Promise.all([
    prisma.project.count({ where: { members: { some: { userId } } } }),
    prisma.task.count({ where: projectFilter }),
    prisma.task.count({ where: { ...projectFilter, status: 'COMPLETED' } }),
    prisma.task.count({ where: { ...projectFilter, status: 'IN_PROGRESS' } }),
    prisma.task.count({ where: { ...projectFilter, status: 'PENDING' } })
  ]);

  // Retorno unificado de datos
  return {
    summary: {
      totalProjects,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks: overdueTasksList.length
    },
    activeProjects,
    overdueTasks: overdueTasksList,
    upcomingTasks: upcomingTasksList,
    recentActivity
  }
}

/**
 * Obtiene el resumen detallado de un proyecto específico usando lógica SQL.
 */
export const getProjectSummary = async (projectId: number) => {
  try {
    const result = await prisma.$queryRaw`SELECT * FROM get_project_summary(${projectId})`
    return result
  } catch (error) {
    console.error("❌ Error en función SQL get_project_summary:", error)
    return { error: "Función de resumen no disponible en este momento" }
  }
}