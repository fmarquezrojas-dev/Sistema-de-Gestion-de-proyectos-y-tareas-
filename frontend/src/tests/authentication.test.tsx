import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const user = { id: 1, name: 'Synthetic', email: 'synthetic@example.invalid', role: 'MEMBER' }
const token = (id: number) => 'header.' + btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 900, jti: id })) + '.signature'
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
const rejected = (config: InternalAxiosRequestConfig, status = 401, data = { code: 'SESSION_INVALID' }) =>
  new AxiosError('Solicitud rechazada', undefined, config, {}, { config, status, data, statusText: '', headers: {} })
beforeEach(() => {
  vi.resetModules()
  localStorage.clear(); sessionStorage.clear()
  let queue = Promise.resolve<unknown>(undefined)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, callback: () => Promise<unknown>) => {
    const next = queue.then(callback); queue = next.catch(() => undefined); return next
  } } })
  vi.stubGlobal('BroadcastChannel', class { postMessage() {} close() {} onmessage = null })
})
afterEach(() => vi.unstubAllGlobals())
async function setup() {
  const auth = await import('../services/authSession')
  const { sessionHttp } = await import('../services/http')
  const { default: api } = await import('../services/api')
  const transport = vi.fn(async (config: InternalAxiosRequestConfig) => response(config,
    config.url === '/auth/me' ? { data: user } : { data: { accessToken: token(2), user } }))
  sessionHttp.defaults.adapter = transport
  return { auth, api, sessionHttp, transport }
}
it('recarga recupera perfil mediante endpoint protegido y elimina claves heredadas', async () => {
  localStorage.setItem('accessToken','legacy'); localStorage.setItem('user','untrusted')
  sessionStorage.setItem('accessToken','legacy')
  const { auth, transport } = await setup()
  const { AuthProvider } = await import('../context/AuthContext')
  const { useAuth } = await import('../context/authState')
  const Probe = () => { const { user, loading } = useAuth(); return <p>{loading ? 'Inicializando' : user?.name || 'Sin sesión'}</p> }
  render(<AuthProvider><Probe /></AuthProvider>)
  expect(screen.getByText('Inicializando')).toBeInTheDocument()
  expect(await screen.findByText('Synthetic')).toBeInTheDocument()
  expect(transport.mock.calls.map(([c]) => c.url)).toEqual(['/auth/refresh','/auth/me'])
  expect(auth.currentAccessToken()).toBe(token(2))
  expect(localStorage.getItem('accessToken')).toBeNull()
  expect(localStorage.getItem('user')).toBeNull()
  expect(sessionStorage.getItem('accessToken')).toBeNull()
  expect(JSON.stringify(localStorage)).not.toContain('signature')
})
it('recarga sin cookie válida muestra login después de inicializar', async () => {
  const { transport } = await setup()
  transport.mockImplementation(async config => { throw rejected(config) })
  const { AuthProvider } = await import('../context/AuthContext')
  const { default: PrivateRoute } = await import('../components/PrivateRoute')
  render(<AuthProvider><MemoryRouter initialEntries={['/private']}><Routes>
    <Route path="/private" element={<PrivateRoute><p>Privado</p></PrivateRoute>} />
    <Route path="/login" element={<p>Acceso</p>} />
  </Routes></MemoryRouter></AuthProvider>)
  expect(await screen.findByText('Acceso')).toBeInTheDocument()
  expect(transport).toHaveBeenCalledTimes(1)
})
it('varios 401 comparten una renovación y cada petición se reintenta una sola vez', async () => {
  const { auth, api, transport } = await setup()
  transport.mockImplementation(async config => response(config, config.url === '/auth/login'
    ? { data: { accessToken: token(1), user } } : config.url === '/auth/me' ? { data: user } : { data: { accessToken: token(2) } }))
  await auth.loginSession(user.email, 'synthetic-password')
  const business = vi.fn(async (config: InternalAxiosRequestConfig) => {
    if (config.headers.Authorization === `Bearer ${token(1)}`) throw rejected(config)
    return response(config, { data: [] })
  })
  api.defaults.adapter = business
  await Promise.all([api.get('/projects'), api.get('/dashboard'), api.get('/tasks/my-tasks')])
  expect(transport.mock.calls.filter(([c]) => c.url === '/auth/refresh')).toHaveLength(1)
  expect(business).toHaveBeenCalledTimes(6)
})
it('401 tardío usa el token nuevo sin provocar otra rotación', async () => {
  const { auth, api, transport } = await setup()
  transport.mockImplementation(async config => response(config, config.url === '/auth/login'
    ? { data: { accessToken: token(1), user } } : config.url === '/auth/me' ? { data: user } : { data: { accessToken: token(2) } }))
  await auth.loginSession(user.email, 'synthetic-password')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === `Bearer ${token(1)}`) {
      if (config.url === '/late') await gate
      throw rejected(config)
    }
    return response(config, {})
  }
  const late = api.get('/late')
  await api.get('/projects')
  release(); await late
  expect(transport.mock.calls.filter(([c]) => c.url === '/auth/refresh')).toHaveLength(1)
})
it('403, credenciales y errores ambiguos de red no renuevan ni reenvían mutaciones', async () => {
  const { api, transport } = await setup()
  const business = vi.fn(async (config: InternalAxiosRequestConfig) => { throw rejected(config, config.url === '/projects' ? 403 : 401) })
  api.defaults.adapter = business
  for (const url of ['/projects', '/auth/login', '/auth/register', '/auth/password', '/auth/refresh']) await expect(api.post(url, {})).rejects.toBeDefined()
  api.defaults.adapter = async config => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) }
  await expect(api.post('/tasks/project/1', {})).rejects.toBeDefined()
  expect(transport).not.toHaveBeenCalled()
  expect(business).toHaveBeenCalledTimes(5)
})
it('refresh fallido se distingue de credenciales inválidas y no entra en bucle', async () => {
  const { auth, api, transport } = await setup()
  transport.mockImplementation(async config => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) })
  api.defaults.adapter = async config => { throw rejected(config) }
  await expect(api.get('/projects')).rejects.toBeDefined()
  expect(auth.getAuthState().status).toBe('error')
  expect(auth.getAuthState().message).toContain('respuesta pudo perderse')
  await expect(api.get('/projects')).rejects.toBeDefined()
  expect(transport).toHaveBeenCalledTimes(1)
})
it('logout durante refresh descarta su respuesta y cierra en servidor después del bloqueo', async () => {
  const { auth, transport } = await setup()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  transport.mockImplementation(async config => {
    if (config.url === '/auth/refresh') await gate
    return response(config, { data: { accessToken: token(2), user } })
  })
  const refreshing = auth.refreshAccess().catch(() => undefined)
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(1))
  const closing = auth.logoutSession()
  expect(auth.currentAccessToken()).toBeNull()
  release(); await Promise.all([refreshing, closing])
  expect(auth.getAuthState().status).toBe('anonymous')
  expect(auth.currentAccessToken()).toBeNull()
  expect(transport.mock.calls.map(([c]) => c.url)).toEqual(['/auth/refresh','/auth/logout'])
})
it('cambio de contraseña limpia memoria e informa nuevo login', async () => {
  const { auth, transport } = await setup()
  await auth.loginSession(user.email, 'synthetic-password')
  await auth.changeSessionPassword('synthetic-password','synthetic-new-password')
  expect(auth.currentAccessToken()).toBeNull()
  expect(auth.getAuthState().user).toBeNull()
  expect(auth.getAuthState().message).toBe('Contraseña actualizada. Inicia sesión nuevamente')
  expect(transport.mock.calls.some(([c]) => c.url === '/auth/password')).toBe(true)
})
it('sin Web Locks no renueva de manera insegura', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  const { auth, transport } = await setup()
  await auth.initializeAuth()
  expect(auth.getAuthState().status).toBe('anonymous')
  expect(auth.getAuthState().message).toContain('navegador')
  expect(transport).not.toHaveBeenCalled()
})

it('si el reintento también recibe 401 se detiene después de una sola renovación', async () => {
  const { api, transport } = await setup()
  const business = vi.fn(async (config: InternalAxiosRequestConfig) => { throw rejected(config) })
  api.defaults.adapter = business
  await expect(api.get('/projects')).rejects.toBeDefined()
  expect(business).toHaveBeenCalledTimes(2)
  expect(transport.mock.calls.filter(([c]) => c.url === '/auth/refresh')).toHaveLength(1)
})
