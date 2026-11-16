import { useState, useCallback } from 'react'
import api from '../services/api'
import { errorMessage } from '../services/errors'
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const response = await api.get<{ data: T }>(url)
      setData(response.data.data)
    } catch (error) { setError(errorMessage(error, 'Error al cargar datos')) }
    finally { setLoading(false) }
  }, [url])
  return { data, loading, error, fetch }
}
