import { createContext, useState, useEffect, useContext, type ReactNode } from 'react'
import type { User } from '../types'
import api from '../services/api'

interface AuthContextType {
  user: User | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => void // ✅ Ahora está correctamente definido en la interfaz
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const savedUser = localStorage.getItem('user')
    
    // Verificamos que existan datos válidos
    if (token && savedUser && savedUser !== 'undefined') {
      try {
        setAccessToken(token)
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error("Error al parsear usuario:", e)
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    
    // CAMBIO AQUÍ: Usamos 'accessToken' para coincidir con tu backend
    const { accessToken: token, user: userData } = res.data.data 
    
    localStorage.setItem('accessToken', token)
    localStorage.setItem('user', JSON.stringify(userData))
    
    setAccessToken(token)
    setUser(userData)
  }

  const logout = async () => {
    // Es buena práctica intentar avisar al backend, pero opcional
    try { await api.post('/auth/logout') } catch (e) { /* ignore */ }
    
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setAccessToken(null)
    setUser(null)
  }

  // ✅ Ahora updateUser está DENTRO del componente AuthProvider
 const updateUser = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null
      const updated = { ...prev, ...data }
      
      // Persistimos los cambios (incluyendo avatarUrl y avatarColor)
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}