import { Request, Response, NextFunction } from 'express'
import * as authService from '../services/auth.service'

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.register(req.body)
    res.status(201).json({ data: result })
  } catch (err) {
    next(err)
  }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })
    res.json({ data: { accessToken: result.accessToken, user: result.user } })
  } catch (err) {
    next(err)
  }
}

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken
    const result = await authService.refreshToken(token)
    res.json({ data: { accessToken: result.accessToken } })
  } catch (err) {
    next(err)
  }
}


export const logout = (req: Request, res: Response) => {
  res.clearCookie('refreshToken')
  res.json({ data: null, message: 'Sesión cerrada correctamente' })
}

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    const result = await authService.updateProfile(userId, req.body)
    res.json({ data: result })
  } catch (err) { next(err) }
}

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId
    await authService.changePassword(userId, req.body)
    res.json({ data: null, message: 'Contraseña actualizada correctamente' })
  } catch (err) { next(err) }
}