import prisma from '../utils/prismaClient'

export const getDashboard = async (userId: number) => {
  // 1. Proyectos activos: Aseguramos que el conteo no falle
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

  // 2. Tareas vencidas: Es vital para el resumen del frontend
  const overdueTasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: { not: 'COMPLETED' },
      dueDate: { lt: new Date() }
    },
    include: { 
      project: { select: { id: true, name: true } } 
    },
    orderBy: { dueDate: 'asc' }
  })

  // 3. Upcoming tasks: Mapeamos el resultado de la vista SQL 
  // para que coincida con la interfaz del Frontend
  let upcomingTasks: any[] = []
  try {
    const rawData: any[] = await prisma.$queryRaw`SELECT * FROM upcoming_tasks LIMIT 5`
    // Mapeamos para que el frontend no encuentre 'undefined' en los nombres
    upcomingTasks = rawData.map(t => ({
      ...t,
      project: { name: t.project_name }, // Adaptamos project_name a project.name
      assignee: t.assignee_name ? { name: t.assignee_name } : null
    }))
  } catch (error) {
    console.warn("⚠️ Error en vista SQL o vista no existente.");
    upcomingTasks = []
  }

  // 4. Actividad reciente
  const recentActivity = await prisma.task.findMany({
    where: { 
      project: { members: { some: { userId } } } 
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  // 5. Conteos para el Summary (Evitamos valores null/undefined)
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

  // Retornamos el objeto con la estructura EXACTA que espera el Dashboard.tsx
  return {
    summary: {
      totalProjects: totalProjects || 0,
      totalTasks: totalTasks || 0,
      completedTasks: completedTasks || 0,
      pendingTasks: (totalTasks - completedTasks) || 0,
      overdueTasks: overdueTasks.length || 0
    },
    activeProjects: activeProjects || [],
    myPendingTasks: [], // Puedes agregar la consulta aquí si la necesitas
    overdueTasks: overdueTasks || [],
    upcomingTasks: upcomingTasks || [],
    recentActivity: recentActivity || []
  }
}

export const getProjectSummary = async (projectId: number) => {
  try {
    const result = await prisma.$queryRaw`SELECT * FROM get_project_summary(${projectId})`
    return result
  } catch (error) {
    console.error("❌ Error en función SQL get_project_summary:", error)
    return { error: "Función de resumen no disponible" }
  }
}