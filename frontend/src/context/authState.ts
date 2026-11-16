import { createContext, useContext } from 'react'
import type { AuthState } from '../services/authSession'
import type { User } from '../types'
export interface AuthContextType extends AuthState {
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateUser: (data: Partial<User>) => void
}
export const AuthContext = createContext<AuthContextType | null>(null)
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider')
  return context
}
