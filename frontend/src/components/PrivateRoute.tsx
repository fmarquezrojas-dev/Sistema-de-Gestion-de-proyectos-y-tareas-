import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/authState'
import type { ReactElement } from 'react'
const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading, status, message, logout } = useAuth()
  if (loading) return <div role="status">Recuperando sesión...</div>
  if (status === 'error') return <div role="alert">
    <p>{message}</p><Link to="/login">Iniciar sesión</Link>
    <button onClick={() => { void logout() }}>Reintentar cierre de sesión</button>
  </div>
  if (!user) return <Navigate to="/login" replace />
  return children
}
export default PrivateRoute
