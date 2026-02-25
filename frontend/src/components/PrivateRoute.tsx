import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { ReactElement } from 'react' // <-- Solución aquí

const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth()
  
  if (loading) return <div>Cargando...</div>
  if (!user) return <Navigate to="/login" replace />

  return children
}

export default PrivateRoute