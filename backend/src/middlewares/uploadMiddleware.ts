/**
 * backend/src/middlewares/uploadMiddleware.ts
 *
 * Middleware de Multer que procesa la imagen en MEMORIA (no la guarda en disco).
 * Valida tipo de archivo y tamaño antes de pasarla al controlador.
 *
 * Instala las dependencias:
 *   npm install multer
 *   npm install -D @types/multer
 */

import multer, { FileFilterCallback } from 'multer'
import { Request } from 'express'

// ── Tipos MIME permitidos ──────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 2

// ── Storage: en memoria → el buffer llega a req.file.buffer ──────────────────
const storage = multer.memoryStorage()

// ── Filtro de archivos ────────────────────────────────────────────────────────
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(
      new Error(
        `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_MIME_TYPES.join(', ')}`,
      ),
    )
  }
}

// ── Instancia de Multer configurada ──────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE_MB * 1024 * 1024, // 2MB en bytes
  },
})

/**
 * Middleware listo para usar en la ruta.
 * Espera un campo de formulario llamado "avatar".
 *
 * Uso en rutas:
 *   router.patch('/profile/avatar', uploadAvatar, authController.updateAvatar)
 */
export const uploadAvatar = upload.single('avatar')

/**
 * Middleware de manejo de errores específico para Multer.
 * Debe colocarse DESPUÉS de uploadAvatar en la ruta para capturar sus errores.
 *
 * Uso en rutas:
 *   router.patch('/profile/avatar', uploadAvatar, handleUploadError, authController.updateAvatar)
 */
export const handleUploadError = (
  err: any,
  _req: Request,
  res: any,
  next: any,
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `La imagen no puede superar ${MAX_SIZE_MB}MB`,
      })
    }
    return res.status(400).json({ error: `Error al procesar archivo: ${err.message}` })
  }

  if (err instanceof Error) {
    return res.status(400).json({ error: err.message })
  }

  next(err)
}