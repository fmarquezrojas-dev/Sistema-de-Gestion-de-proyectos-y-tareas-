import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { JwtPayload } from '../models/types'
// ✅ Nuevas importaciones para Cloudinary
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  extractPublicId,
} from '../utils/cloudinary'

// ─── GENERACIÓN DE TOKENS ──────────────────────────────────────────────────
const generateAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET! as string, {
    expiresIn: '15m'
  } as jwt.SignOptions)
}

const generateRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET! as string, {
    expiresIn: '7d'
  } as jwt.SignOptions)
}

// ─── REGISTRO Y LOGIN ──────────────────────────────────────────────────────
export const register = async (body: { name: string; email: string; password: string }) => {
  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) throw new AppError(409, 'El email ya está registrado')

  const hashedPassword = await bcrypt.hash(body.password, 10)

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashedPassword
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      createdAt: true
    }
  })

  return user
}

export const login = async (body: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { email: body.email } })
  if (!user) throw new AppError(401, 'Credenciales inválidas')

  const validPassword = await bcrypt.compare(body.password, user.password)
  if (!validPassword) throw new AppError(401, 'Credenciales inválidas')

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl
    }
  }
}

// ─── FUNCIONES DE CLOUDINARY (NUEVAS) ──────────────────────────────────────

/**
 * Sube una nueva imagen, elimina la anterior de la nube y actualiza la DB
 */
export const updateAvatar = async (userId: number, imageData: Buffer | string) => {
  // 1. Obtener usuario actual para ver si ya tiene foto
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  // 2. Si ya tenía foto anterior, eliminarla de Cloudinary para no acumular basura
  if (currentUser?.avatarUrl) {
    const oldPublicId = extractPublicId(currentUser.avatarUrl);
    if (oldPublicId) {
      // Intentamos borrar, pero no bloqueamos si falla
      await deleteImageFromCloudinary(oldPublicId);
    }
  }

  // 3. Subir nueva imagen a Cloudinary
  // Usamos el ID del usuario como publicId para que se mantenga una estructura limpia
  const publicId = `user_${userId}`;
  
  // Esta función ahora es "híbrida" gracias a la corrección en cloudinary.ts
  const secureUrl = await uploadImageToCloudinary(imageData, publicId);

  // 4. Actualizar la base de datos con la nueva URL (secure_url de Cloudinary)
  return await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: secureUrl },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
};

/**
 * Elimina la foto de Cloudinary y pone el campo avatarUrl en null en la DB
 */
export const removeAvatar = async (userId: number) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  })

  if (currentUser?.avatarUrl) {
    const publicId = extractPublicId(currentUser.avatarUrl)
    if (publicId) {
      await deleteImageFromCloudinary(publicId)
    }
  }

  return await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      avatarUrl: true,
    }
  })
}

// ─── PERFIL Y CUENTA ────────────────────────────────────────────────────────
export const updateProfile = async (
  userId: number,
  body: { name: string; email: string; avatarColor?: string; avatarUrl?: string }
) => {
  const existing = await prisma.user.findFirst({
    where: { email: body.email, NOT: { id: userId } }
  })
  if (existing) throw new AppError(409, 'Ese correo ya pertenece a otro miembro del equipo')

  return prisma.user.update({
    where: { id: userId },
    data: { 
      name: body.name, 
      email: body.email, 
      avatarColor: body.avatarColor,
      avatarUrl: body.avatarUrl
    },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      role: true, 
      createdAt: true, 
      avatarColor: true,
      avatarUrl: true
    }
  })
}

export const changePassword = async (userId: number, body: { currentPassword: string; newPassword: string }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(404, 'Usuario no encontrado')

  const valid = await bcrypt.compare(body.currentPassword, user.password)
  if (!valid) throw new AppError(401, 'La contraseña actual es incorrecta')

  const hashed = await bcrypt.hash(body.newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
}

export const refreshToken = async (token: string) => {
  if (!token) throw new AppError(401, 'Refresh token no proporcionado')

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload
    const accessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    })
    return { accessToken }
  } catch {
    throw new AppError(401, 'Refresh token inválido o expirado')
  }
}

export const getProfileStats = async (userId: number) => {
  const [totalProjects, pendingTasks] = await Promise.all([
    prisma.projectMember.count({ where: { userId } }),
    prisma.task.count({
      where: { assigneeId: userId, status: { not: 'COMPLETED' } }
    })
  ])
  return { totalProjects, pendingTasks }
}

export const deleteAccount = async (userId: number, password: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError(404, 'Usuario no encontrado')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) throw new AppError(401, 'Contraseña incorrecta')

  await prisma.user.delete({ where: { id: userId } })
}

export const searchUsers = async (query: string, excludeUserId: number) => {
  if (!query || query.length < 2) return []
  return prisma.user.findMany({
    where: {
      AND: [
        { id: { not: excludeUserId } },
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } }
          ]
        }
      ]
    },
    select: { id: true, name: true, email: true, avatarColor: true, avatarUrl: true },
    take: 5
  })
}