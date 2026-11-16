import { isAxiosError } from 'axios'
import type { User } from '../types'
import { sessionHttp } from './http'

export type AuthStatus = 'initializing' | 'authenticated' | 'anonymous' | 'error'
export interface AuthState { user: User | null; accessToken: string | null; status: AuthStatus; message: string | null }
let state: AuthState = { user: null, accessToken: null, status: 'initializing', message: null }
const listeners = new Set<() => void>()
export const getAuthState = () => state
export const subscribeAuth = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const setState = (patch: AuthState) => { state = patch; listeners.forEach(fn => fn()) }
const markerKey = 'synkro.auth.generation' // Solo un nonce de coordinación; nunca credenciales.
const lockName = 'synkro.auth.session'
let memoryGeneration = ''
let refreshPromise: Promise<string> | null = null
let initializePromise: Promise<void> | null = null

let storageAvailable = true
export function clearLegacyStorage() {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { window[name].removeItem('accessToken'); window[name].removeItem('user') }
    catch { storageAvailable = false }
  }
}
const generation = () => {
  try { return localStorage.getItem(markerKey) || '' }
  catch { storageAvailable = false; return memoryGeneration }
}
const supported = () => Boolean(storageAvailable && typeof navigator.locks?.request === 'function' && typeof BroadcastChannel !== 'undefined')
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('synkro.auth') : null
const publish = (message: object) => channel?.postMessage(message)
const empty = (status: AuthStatus, message: string | null) => setState({ accessToken: null, user: null, status, message })
const isCurrent = (ticket: string) => generation() === ticket
const active = () => generation().startsWith('active:')
function freshGeneration(blocked: boolean) {
  const ticket = (blocked ? 'blocked:' : 'active:') + crypto.randomUUID()
  try { localStorage.setItem(markerKey, ticket) } catch { storageAvailable = false }
  memoryGeneration = ticket
  return ticket
}
function usable(token: string | null) {
  if (!token) return false
  try {
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof claims.exp === 'number' && claims.exp * 1000 > Date.now() + 1000
  } catch { return false }
}
function accept(accessToken: string, user: User | null, ticket: string, broadcast = true) {
  if (!isCurrent(ticket) || !active()) return
  memoryGeneration = ticket
  setState({ accessToken, user, status: user ? 'authenticated' : 'initializing', message: null })
  if (broadcast) publish({ type: 'TOKEN', accessToken, user, generation: ticket })
}
function end(message: string | null, status: AuthStatus = 'anonymous') {
  const ticket = freshGeneration(true)
  empty(status, message)
  publish({ type: 'END', generation: ticket, message, status })
  return ticket
}
const peerWaiters = new Set<() => void>()
if (channel) channel.onmessage = (event: MessageEvent<unknown>) => {
  const data = event.data
  if (!data || typeof data !== 'object' || !('type' in data)) return
  const message = data as { type: string; generation?: string; accessToken?: string; user?: User; message?: string; status?: AuthStatus }
  if (message.type === 'REQUEST') {
    if (memoryGeneration === generation() && usable(state.accessToken) && state.user) {
      publish({ type: 'TOKEN', generation: memoryGeneration, accessToken: state.accessToken, user: state.user })
    }
  } else if (message.generation === generation()) {
    if (message.type === 'END') {
      memoryGeneration = message.generation || ''
      empty(message.status === 'error' ? 'error' : 'anonymous', message.message || null)
      peerWaiters.forEach(resolve => resolve())
    } else if (message.type === 'TOKEN' && typeof message.accessToken === 'string' && usable(message.accessToken) && active()) {
      accept(message.accessToken, message.user || null, message.generation || '', false)
      peerWaiters.forEach(resolve => resolve())
    }
  }
}
window.addEventListener('storage', event => {
  if (event.key === markerKey && memoryGeneration !== generation()) {
    memoryGeneration = generation()
    empty('anonymous', 'La sesión cambió en otra pestaña')
  }
})
async function askPeers() {
  await new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); peerWaiters.delete(done); resolve() }
    const timer = setTimeout(done, 100)
    peerWaiters.add(done)
    publish({ type: 'REQUEST' })
  })
}
async function locked<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator.locks?.request !== 'function') return work() // Refresh exige soporte completo antes.
  return navigator.locks.request(lockName, work)
}
export function refreshAccess(failedToken: string | null = state.accessToken): Promise<string> {
  if (refreshPromise) return refreshPromise
  if (!supported()) {
    end('Este navegador no permite renovar la sesión de forma segura. Inicia sesión nuevamente')
    return Promise.reject(new Error('Renovación no disponible en este navegador'))
  }
  const requestedGeneration = generation()
  refreshPromise = locked(async () => {
    if (requestedGeneration !== generation() && failedToken !== null) throw new Error('La sesión cambió')
    if (!generation()) freshGeneration(false)
    if (!active()) throw new Error('Inicia sesión nuevamente')
    const ticket = generation()
    await askPeers()
    if (!isCurrent(ticket)) throw new Error('La sesión cambió')
    if (usable(state.accessToken) && state.accessToken !== failedToken && memoryGeneration === ticket) return state.accessToken!
    try {
      const response = await sessionHttp.post<{ data: { accessToken: string } }>('/auth/refresh')
      if (!isCurrent(ticket)) throw new Error('La sesión cambió')
      const token = response.data.data.accessToken
      const profile = await sessionHttp.get<{ data: User }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (!isCurrent(ticket)) throw new Error('La sesión cambió')
      accept(token, profile.data.data, ticket)
      return token
    } catch (error) {
      if (isCurrent(ticket)) {
        if (isAxiosError(error) && error.response?.status === 401) end('Tu sesión terminó. Inicia sesión nuevamente')
        else end('No se pudo recuperar la sesión. La respuesta pudo perderse; vuelve a iniciar sesión de forma segura', 'error')
      }
      throw error
    }
  }).finally(() => { refreshPromise = null })
  return refreshPromise
}
export function initializeAuth() {
  if (!initializePromise) initializePromise = (async () => {
    clearLegacyStorage()
    try { await refreshAccess(null) }
    catch { if (state.status === 'initializing') empty('anonymous', 'Inicia sesión para continuar') }
  })()
  return initializePromise
}
export async function loginSession(email: string, password: string) {
  clearLegacyStorage()
  const ticket = freshGeneration(false)
  empty('initializing', null)
  publish({ type: 'END', generation: ticket })
  try {
    await locked(async () => {
      if (!isCurrent(ticket)) throw new Error('La sesión cambió')
      const result = await sessionHttp.post<{ data: { accessToken: string; user: User } }>('/auth/login', { email, password })
      if (!isCurrent(ticket)) throw new Error('La sesión cambió')
      accept(result.data.data.accessToken, result.data.data.user, ticket)
    })
  } catch (error) {
    if (isCurrent(ticket)) end(isAxiosError<{ error?: string }>(error)
      ? error.response?.data?.error || 'No se pudo conectar. Inténtalo más tarde'
      : 'No se pudo iniciar sesión')
    throw error
  }
}
export async function logoutSession() {
  clearLegacyStorage()
  const ticket = end('Sesión cerrada')
  try {
    await locked(async () => {
      // No cerrar una sesión nueva iniciada después de este logout.
      if (isCurrent(ticket)) await sessionHttp.post('/auth/logout')
    })
  } catch {
    if (isCurrent(ticket)) empty('error', 'Cierre local realizado, pero no se pudo confirmar la revocación en el servidor. Reintenta cerrar sesión')
  }
}
export async function changeSessionPassword(currentPassword: string, newPassword: string) {
  if (!usable(state.accessToken)) await refreshAccess(state.accessToken)
  const token = state.accessToken
  const ticket = generation()
  await locked(async () => {
    if (!isCurrent(ticket)) throw new Error('La sesión cambió')
    try {
      await sessionHttp.put('/auth/password', { currentPassword, newPassword }, { headers: { Authorization: `Bearer ${token}` } })
      if (isCurrent(ticket)) end('Contraseña actualizada. Inicia sesión nuevamente')
    } catch (error) {
      if (isCurrent(ticket) && (!isAxiosError(error) || !error.response || error.response.status >= 500)) {
        end('No se pudo confirmar el cambio de contraseña. Inicia sesión nuevamente', 'error')
      }
      throw error
    }
  })
}
export function updateSessionUser(data: Partial<User>) {
  if (state.user) setState({ ...state, user: { ...state.user, ...data } })
}
export const currentAccessToken = () => memoryGeneration === generation() && active() ? state.accessToken : null
