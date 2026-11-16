import { test, expect, type Page } from '@playwright/test'
const password = 'synthetic-browser-password'
let email: string
test.beforeEach(async ({ request }) => {
  email = `browser-${crypto.randomUUID()}@example.invalid`
  const registered = await request.post('http://localhost:3001/api/auth/register', {
    headers: { Origin: 'http://localhost:5174' }, data: { name: 'Browser Synthetic', email, password },
  })
  expect(registered.status()).toBe(201)
})
async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(password)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
}
async function state(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/services/authSession.ts'
    const auth = await import(/* @vite-ignore */ path)
    const snapshot = auth.getAuthState()
    return { status: snapshot.status, hasToken: Boolean(auth.currentAccessToken()), hasUser: Boolean(snapshot.user) }
  })
}
async function getProjects(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/services/api.ts'
    const { default: api } = await import(/* @vite-ignore */ path)
    return (await api.get('/projects')).status
  })
}
test('recarga y dos pestañas comparten cookie, coordinan refresh y propagan logout', async ({ page, context }) => {
  await login(page)
  await page.reload()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect.poll(() => state(page)).toMatchObject({ status: 'authenticated' })
  const second = await context.newPage()
  await second.goto('/projects')
  await expect.poll(() => state(second)).toMatchObject({ status: 'authenticated' })
  const cookies = await context.cookies()
  const refresh = cookies.find(cookie => cookie.name === 'refreshToken')!
  expect(refresh.httpOnly).toBe(true)
  expect(refresh.path).toBe('/api/auth')
  for (const tab of [page, second]) {
    expect(await tab.evaluate(() => localStorage.getItem('accessToken') === null && sessionStorage.getItem('accessToken') === null && localStorage.getItem('user') === null)).toBe(true)
    expect(await tab.evaluate(() => !document.cookie.includes('refreshToken'))).toBe(true)
  }
  let refreshRequests = 0
  context.on('request', req => { if (req.url().endsWith('/auth/refresh')) refreshRequests++ })
  await Promise.all([page.reload(), second.reload()])
  await expect.poll(() => state(page)).toMatchObject({ status: 'authenticated' })
  await expect.poll(() => state(second)).toMatchObject({ status: 'authenticated' })
  expect(refreshRequests).toBe(1)
  refreshRequests = 0
  // Access TTL de solo 4s en este servidor de pruebas, no en la configuración normal.
  await page.waitForTimeout(4200)
  const results = await Promise.all([getProjects(page), getProjects(second)])
  expect(results).toEqual([200,200])
  expect(refreshRequests).toBe(1)
  await page.evaluate(async () => {
    const path = '/src/services/authSession.ts'
    await (await import(/* @vite-ignore */ path)).logoutSession()
  })
  await expect.poll(() => state(second)).toEqual({ status: 'anonymous', hasToken: false, hasUser: false })
  await second.reload()
  await expect(second).toHaveURL(/\/login$/)
})
test('logout en otra pestaña impide restaurar una sesión con refresh en vuelo', async ({ page, context }) => {
  await login(page)
  const second = await context.newPage()
  await second.goto('/projects')
  await expect.poll(() => state(second)).toMatchObject({ status: 'authenticated' })
  let release!: () => void, captured!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const reached = new Promise<void>(resolve => { captured = resolve })
  await page.route('**/auth/refresh', async route => {
    const response = await route.fetch()
    captured()
    await held
    await route.fulfill({ response })
  })
  const refreshing = page.evaluate(async () => {
    const path = '/src/services/authSession.ts'
    try { await (await import(/* @vite-ignore */ path)).refreshAccess() } catch { /* sesión cambiada */ }
  })
  await reached
  const closing = second.evaluate(async () => {
    const path = '/src/services/authSession.ts'
    await (await import(/* @vite-ignore */ path)).logoutSession()
  })
  try {
    await expect.poll(() => state(page)).toEqual({ status: 'anonymous', hasToken: false, hasUser: false })
  } finally { release() }
  await Promise.all([refreshing, closing])
  for (const tab of [page, second]) expect(await state(tab)).toEqual({ status: 'anonymous', hasToken: false, hasUser: false })
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
})
test('cambio de contraseña termina las sesiones visibles en ambas pestañas', async ({ page, context }) => {
  await login(page)
  const second = await context.newPage()
  await second.goto('/projects')
  await expect.poll(() => state(second)).toMatchObject({ status: 'authenticated' })
  await page.evaluate(async ({ password }) => {
    const path = '/src/services/authSession.ts'
    await (await import(/* @vite-ignore */ path)).changeSessionPassword(password, 'synthetic-browser-new-password')
  }, { password })
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada')
  await expect.poll(() => state(second)).toEqual({ status: 'anonymous', hasToken: false, hasUser: false })
})
