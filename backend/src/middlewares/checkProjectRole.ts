/**
 * backend/src/middlewares/checkProjectRole.ts
 *
 * Middleware RBAC para proteger rutas de proyectos.
 * Verifica que el usuario autenticado tenga el rol requerido en el proyecto.
 *
 * Uso en rutas:
 *   router.delete('/:id',           authenticate, checkProjectRole(['OWNER']),           deleteProject)
 *   router.post('/:id/members',     authenticate, checkProjectRole(['OWNER']),           addMember)
 *   router.patch('/:id/tasks',      authenticate, checkProjectRole(['OWNER', 'MEMBER']), createTask)
 *   router.delete('/:id/members/:memberId', authenticate, checkProjectRole(['OWNER']),  removeMember)
 */

import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import prisma from '../utils/prismaClient'

//const prisma = new PrismaClient()

// Roles posibles en un proyecto
type ProjectRole = 'OWNER' | 'MEMBER'

/**
 * Genera un middleware que verifica que el usuario tiene alguno de los roles dados.
 * También permite paso a ADMINs del sistema globales (si tienes ese rol).
 *
 * @param allowedRoles  Roles que pueden pasar ('OWNER', 'MEMBER')
 * @param allowAdmin    Si true, los usuarios con role ADMIN global también pasan (default: true)
 */
export const checkProjectRole = (
  allowedRoles: ProjectRole[],
  allowAdmin = true,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId    = (req as any).user?.id
        const projectId = parseInt((req.params.id || req.params.projectId) as string, 10)

      if (!userId) {
        return res.status(401).json({ error: 'No autenticado' })
      }

      if (isNaN(projectId)) {
        return res.status(400).json({ error: 'ID de proyecto inválido' })
      }

      // Admins globales del sistema siempre tienen acceso (opcional)
      if (allowAdmin) {
        const globalUser = await prisma.user.findUnique({
          where:  { id: userId },
          select: { role: true },
        })
        if (globalUser?.role === 'ADMIN') return next()
      }

      // Buscar membresía del usuario en este proyecto
      const membership = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: { userId, projectId },
        },
        select: {
          role:           true,
          canCreateTasks: true,
          canEditTasks:   true,
        },
      })

      if (!membership) {
        return res.status(403).json({
          error: 'No eres miembro de este proyecto',
        })
      }

      if (!allowedRoles.includes(membership.role as ProjectRole)) {
        return res.status(403).json({
          error: `Acción no permitida. Se requiere rol: ${allowedRoles.join(' o ')}`,
          yourRole: membership.role,
        })
      }

      // Adjuntar membresía al request para que el controlador la use sin re-fetch
      ;(req as any).projectMembership = membership

      return next()
    } catch (error) {
      console.error('[checkProjectRole]', error)
      return res.status(500).json({ error: 'Error al verificar permisos' })
    }
  }
}

/**
 * Middleware para verificar permiso granular (canCreateTasks / canEditTasks).
 * Owners siempre tienen todos los permisos.
 *
 * Uso:
 *   router.post('/:id/tasks', authenticate, checkProjectPermission('canCreateTasks'), createTask)
 */
export const checkProjectPermission = (
  permission: 'canCreateTasks' | 'canEditTasks',
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId    = (req as any).user?.id
      const projectId = parseInt((req.params.id || req.params.projectId) as string, 10)

      if (!userId || isNaN(projectId)) {
        return res.status(400).json({ error: 'Parámetros inválidos' })
      }

      const membership = await prisma.projectMember.findUnique({
        where:  { userId_projectId: { userId, projectId } },
        select: { role: true, canCreateTasks: true, canEditTasks: true },
      })

      if (!membership) {
        return res.status(403).json({ error: 'No eres miembro de este proyecto' })
      }

      // Owner siempre puede todo
      if (membership.role === 'OWNER') return next()

      if (!membership[permission]) {
        const labels: Record<string, string> = {
          canCreateTasks: 'crear tareas',
          canEditTasks:   'editar tareas',
        }
        return res.status(403).json({
          error: `No tienes permiso para ${labels[permission]} en este proyecto`,
        })
      }

      ;(req as any).projectMembership = membership
      return next()
    } catch (error) {
      console.error('[checkProjectPermission]', error)
      return res.status(500).json({ error: 'Error al verificar permisos' })
    }
  }
}

// ─── Ejemplo de uso en auth.routes.ts ─────────────────────────────────────────
/*
import { checkProjectRole, checkProjectPermission } from '../middlewares/checkProjectRole'

// Solo el OWNER puede eliminar el proyecto
router.delete('/:id', authenticate, checkProjectRole(['OWNER']), deleteProject)

// Solo el OWNER puede añadir/quitar miembros
router.post('/:id/members',          authenticate, checkProjectRole(['OWNER']), addMember)
router.delete('/:id/members/:mid',   authenticate, checkProjectRole(['OWNER']), removeMember)

// Cualquier miembro puede ver el proyecto
router.get('/:id', authenticate, checkProjectRole(['OWNER', 'MEMBER']), getProject)

// Crear tarea: requiere permiso granular canCreateTasks (o ser OWNER)
router.post('/:id/tasks', authenticate, checkProjectPermission('canCreateTasks'), createTask)

// Editar/eliminar tarea: requiere permiso granular canEditTasks (o ser OWNER)
router.put('/tasks/:taskId',    authenticate, checkProjectPermission('canEditTasks'), updateTask)
router.delete('/tasks/:taskId', authenticate, checkProjectPermission('canEditTasks'), deleteTask)
*/