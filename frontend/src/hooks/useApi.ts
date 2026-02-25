import { useState, useCallback } from 'react'
import api from '../services/api'

export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
  setLoading(true)
  setError(null)
  try {
    const token = localStorage.getItem('accessToken')
    
    const res = await api.get<any>(url, { // Cambiamos T por any para validar la estructura
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    
    // --- SOLUCIÓN AQUÍ ---
    // Si res.data tiene una propiedad .data (como antes), la usamos.
    // Si no, usamos res.data directamente (como ahora).
    const result = res.data && res.data.data !== undefined ? res.data.data : res.data;
    
    setData(result)
  } catch (err: any) {
    if (err.response?.status === 401) {
      setError('Sesión expirada. Por favor, vuelve a ingresar.')
    } else {
      setError(err.response?.data?.error || 'Error al cargar datos')
    }
  } finally {
    setLoading(false)
  }
}, [url])

  return { data, loading, error, fetch }
}