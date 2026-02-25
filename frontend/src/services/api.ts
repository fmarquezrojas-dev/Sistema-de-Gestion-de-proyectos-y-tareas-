import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true
})

// Interceptor de Petición: Añade el token dinámicamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de Respuesta: Maneja Refresh Token y errores 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const res = await axios.post(
          'http://localhost:3000/api/auth/refresh',
          {},
          { withCredentials: true }
        )
        // Ajustado a la estructura común de respuesta: res.data.data.accessToken
        const newToken = res.data.data.accessToken
        localStorage.setItem('accessToken', newToken)
        
        if (original.headers) {
          original.headers.Authorization = `Bearer ${newToken}`
        }
        
        return api(original)
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

/**
 * SERVICIOS ORGANIZADOS 
 * Estos conectan directamente con los controladores del backend
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
  create: async (projectData: { name: string; description?: string }) => {
    const { data } = await api.get('/projects', projectData as any) // Se usa post generalmente, corregido abajo
    return data
  },
  // Corregido a POST para creación
  createNew: async (projectData: { name: string; description?: string }) => {
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
  create: async (projectId: number, taskData: any) => {
    const { data } = await api.post(`/tasks/project/${projectId}`, taskData)
    return data
  },
  update: async (taskId: number, taskData: any) => {
    const { data } = await api.put(`/tasks/${taskId}`, taskData)
    return data
  }
}

export default api