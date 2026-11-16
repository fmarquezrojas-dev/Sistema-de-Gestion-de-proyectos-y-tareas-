/**
 * backend/src/utils/cloudinary.ts
 *
 * Configura y exporta el SDK de Cloudinary v2.
 * Corregido para soportar tanto Buffers como strings Base64 del Frontend.
 */

import { v2 as cloudinary } from 'cloudinary'

// Configuración de la cuenta
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
  secure:     true,
})

/**
 * Sube una imagen a Cloudinary (soporta Buffer o Base64).
 *
 * @param fileData  Datos de la imagen (Buffer de Multer o string Base64)
 * @param publicId  ID único para la imagen (e.g. "avatars/user_42")
 * @returns         URL segura de Cloudinary (HTTPS)
 */
export const uploadImageToCloudinary = (
  fileData: Buffer | string,
  publicId: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // ── Opciones de transformación y optimización ──────────────────
    const options = {
      public_id:      publicId,
      overwrite:      true,
      folder:         'avatars',
      resource_type:  'image' as const,
      transformation: [
        {
          width: 256,
          height: 256,
          crop: 'fill',
          gravity: 'face',
          quality: 'auto:good',
          fetch_format: 'auto',
        },
      ],
    }

    // Caso A: Si es un String (Base64 enviado vía JSON desde el perfil)
    if (typeof fileData === 'string') {
      cloudinary.uploader.upload(fileData, options, (error, result) => {
        if (error || !result) {
          console.error('[Cloudinary] Operación no disponible')
          return reject(error ?? new Error('Upload fallido'))
        }
        resolve(result.secure_url)
      })
    } 
    // Caso B: Si es un Buffer (Archivo enviado vía Multer/FormData)
    else {
      cloudinary.uploader
        .upload_stream(options, (error, result) => {
          if (error || !result) {
            console.error('[Cloudinary] Operación no disponible')
            return reject(error ?? new Error('Upload fallido'))
          }
          resolve(result.secure_url)
        })
        .end(fileData)
    }
  })
}

/**
 * Elimina una imagen de Cloudinary por su public_id.
 */
export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (err) {
    console.warn('[Cloudinary] No se pudo eliminar el avatar externo')
  }
}

/**
 * Extrae el public_id de una URL de Cloudinary.
 * Ejemplo: ".../avatars/user_42.png" -> "avatars/user_42"
 */
export const extractPublicId = (cloudinaryUrl: string): string | null => {
  try {
    if (!cloudinaryUrl) return null
    const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z]+$/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export default cloudinary