import type { TaskUpdate, TaskMutation } from '../types'
import axios, { type InternalAxiosRequestConfig } from 'axios'
import { apiURL } from './http'
import { currentAccessToken, refreshAccess } from './authSession'
interface RetryConfig extends InternalAxiosRequestConfig { _retry?: boolean; _sentToken?: string | null }
const api = axios.create({ baseURL: apiURL, withCredentials: true })
api.interceptors.request.use((config: RetryConfig) => {
  const token = currentAccessToken()
  config._sentToken = token
  if (token) config.headers.Authorization = `Bearer ${token}`
  else delete config.headers.Authorization
  return config
})
api.interceptors.response.use(response => response, async (error: unknown) => {
  if (!axios.isAxiosError<{ code?: string }>(error)) return Promise.reject(error)
  const original = error.config as RetryConfig | undefined
  if (error.response?.status === 403 || (error.response?.status === 404 && original?.method !== 'get')) {
    window.dispatchEvent(new Event('synkro:access-changed'))
  }
  const excluded = /\/auth\/(login|register|refresh|logout|password|account)(?:$|\?)/.test(original?.url || '')
  // SESSION_INVALID solo se emite antes de ejecutar el controlador de negocio.
  if (original && !excluded && !original._retry && error.response?.status === 401 && error.response.data.code === 'SESSION_INVALID') {
    original._retry = true
    const current = currentAccessToken()
    if (!current || current === original._sentToken) await refreshAccess(original._sentToken || null)
    return api(original)
  }
  return Promise.reject(error)
})

/**
 * SERVICIOS ORGANIZADOS 
 */

export const dashboardService = {
  getStats: async () => {
    const { data } = await api.get('/dashboard')
    return data
  }
}

export const projectService = {
  getAll: async () => {
    const { data } = await api.get('/projects')
    return data
  },
  getById: async (id: number) => {
    const { data } = await api.get(`/projects/${id}`)
    return data
  },
  // ✅ CORREGIDO: Usar .post en lugar de .get
  create: async (projectData: { name: string; description?: string }) => {
    const { data } = await api.post('/projects', projectData)
    return data
  },
  addMember: async (projectId: number, email: string) => {
    const { data } = await api.post(`/projects/${projectId}/members`, { email })
    return data
  }
}

export const taskService = {
  getMyTasks: async () => {
    const { data } = await api.get('/tasks/my-tasks')
    return data
  },
  create: async (projectId: number, taskData: TaskUpdate) => {
    const { data } = await api.post(`/tasks/project/${projectId}`, taskData)
    return data
  },
  update: async (taskId: number, taskData: TaskMutation) => {
    const { data } = await api.put(`/tasks/${taskId}`, taskData)
    return data
  }
}

export default api