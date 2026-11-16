import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { AuthContext } from './authState'
import { subscribeAuth, getAuthState, initializeAuth, loginSession, logoutSession, changeSessionPassword, updateSessionUser } from '../services/authSession'
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const state = useSyncExternalStore(subscribeAuth, getAuthState)
  useEffect(() => { void initializeAuth() }, [])
  return <AuthContext.Provider value={{
    ...state, loading: state.status === 'initializing', login: loginSession,
    logout: logoutSession, changePassword: changeSessionPassword, updateUser: updateSessionUser,
  }}>{children}</AuthContext.Provider>
}
