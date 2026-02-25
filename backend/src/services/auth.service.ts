import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prismaClient'
import { AppError } from '../middlewares/errorHandler'
import { JwtPayload } from '../models/types'

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
      role: user.role
    }
  }
}
export const updateProfile = async (userId: number, body: { name: string; email: string }) => {
  const existing = await prisma.user.findFirst({
    where: { email: body.email, NOT: { id: userId } }
  })
  if (existing) throw new AppError(409, 'El email ya está en uso')

  return prisma.user.update({
    where: { id: userId },
    data: { name: body.name, email: body.email },
    select: { id: true, name: true, email: true, role: true }
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