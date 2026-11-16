import { isAxiosError } from 'axios'
export function errorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}
export function errorMessage(error: unknown, fallback = 'No se pudo completar la operación'): string {
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 404) return 'El recurso ya no existe o no tienes acceso'
    return error.response?.data?.error || fallback
  }
  return fallback
}
