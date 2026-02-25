import { createContext, useState, useEffect, useContext, type ReactNode } from 'react'
import type { User } from '../types'
import api from '../services/api'

interface AuthContextType {
  user: User | null
  accessToken: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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
    
    // PROTECCIÓN: Verificamos que savedUser no sea null ni el string "undefined"
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
    const { token, user: userData } = res.data.data // Ajustado a nuestra estructura de API
    
    localStorage.setItem('accessToken', token)
    localStorage.setItem('user', JSON.stringify(userData))
    
    setAccessToken(token)
    setUser(userData)
  }

  const logout = async () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, loading }}>
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