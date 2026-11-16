import { setRefreshCookie, clearRefreshCookie } from '../middlewares/sessionSecurity'
import { actorId } from '../middlewares/authMiddleware'
import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../middlewares/errorHandler";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.login(req.body);
    setRefreshCookie(res, result.refreshToken, result.expiresAt);
    res.json({ data: { accessToken: result.accessToken, user: result.user } });
  } catch (err) {
    next(err);
  }
};

export const getProfileStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = actorId(req);
    const result = await authService.getProfileStats(userId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.refreshToken;
    const result = await authService.refreshToken(token);
    setRefreshCookie(res, result.refreshToken, result.expiresAt);
    res.json({ data: { accessToken: result.accessToken } });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) clearRefreshCookie(res);
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.cookies?.refreshToken);
    clearRefreshCookie(res);
    res.json({ data: null, message: 'Sesión cerrada correctamente' });
  } catch (error) { next(error) }
};
export const getProfile = async (req: Request, res: Response) => {
  res.json({ data: await authService.getProfile(actorId(req)) });
};

// --- GESTIÓN DE AVATAR (CLOUDINARY) ---

/**
 * PATCH /auth/profile/avatar
 * Procesa la imagen subida mediante Multer y la envía al servicio de Cloudinary
 */
export const updateAvatarController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    
    // El archivo viene en req.file gracias al middleware de Multer
    if (!req.file) {
      throw new AppError(400, "No se recibió ninguna imagen");
    }

    const updatedUser = await authService.updateAvatar(userId, req.file.buffer);

    res.json({
      message: "Foto de perfil actualizada correctamente",
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /auth/profile/avatar
 * Elimina la imagen de Cloudinary y limpia el campo en la DB
 */
export const removeAvatarController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req);
    const result = await authService.removeAvatar(userId);

    res.json({
      message: "Foto de perfil eliminada correctamente",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = actorId(req);
    const { name, email, avatarColor, avatarUrl } = req.body;

    let finalAvatarUrl = avatarUrl;

    // 1. Manejo de la imagen ANTES de actualizar el perfil completo
    if (avatarUrl && avatarUrl.startsWith('data:image')) {
      // Solo subimos a Cloudinary, no actualizamos la DB aquí todavía
      // Para esto, llamaríamos al servicio de avatar modificado o directamente a la utilidad
      const updatedUserWithPhoto = await authService.updateAvatar(userId, avatarUrl);
      finalAvatarUrl = updatedUserWithPhoto.avatarUrl;
    } 
    else if (avatarUrl === null) {
      await authService.removeAvatar(userId);
      finalAvatarUrl = null;
    }

    // 2. Una Sola actualización para todo (Nombre, Email, Color y la URL de Cloudinary)
    const result = await authService.updateProfile(userId, {
      name,
      email,
      avatarColor,
      avatarUrl: finalAvatarUrl 
    });

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = actorId(req);
    await authService.changePassword(userId, req.body);
    clearRefreshCookie(res);
    res.json({ data: null, message: "Contraseña actualizada. Inicia sesión nuevamente" });
  } catch (err) {
    next(err);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = actorId(req)
    await authService.deleteAccount(userId, req.body.password)
    clearRefreshCookie(res)
    res.json({ data: null, message: 'Cuenta eliminada correctamente' })
  } catch (err) { next(err) }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = req.query
    const userId = actorId(req)
    const result = await authService.searchUsers(String(q || ''), userId)
    res.json({ data: result })
  } catch (err) { next(err) }
};