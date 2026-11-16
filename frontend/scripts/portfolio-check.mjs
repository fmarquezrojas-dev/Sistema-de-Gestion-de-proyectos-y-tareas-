import { chromium, request, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const web = 'http://localhost:55173', api = 'http://localhost:53010/api', mail = 'http://localhost:58026'
// Exclusivamente proyecto Compose sintético documentado, sin credenciales externas.
const http = await request.newContext({ extraHTTPHeaders: { Origin: web } })
const browser = await chromium.launch()
const stamp = Date.now()
const password = 'synthetic-portfolio-password'
const ownerEmail = `portfolio-owner-${stamp}@example.invalid`, memberEmail = `portfolio-member-${stamp}@example.invalid`
async function register(name, email) {
  const response = await http.post(`${api}/auth/register`, { data: { name, email, password } })
  expect(response.status()).toBe(201)
  return (await response.json()).data
}
async function login(email) {
  const response = await http.post(`${api}/auth/login`, { data: { email, password } })
  expect(response.status()).toBe(200)
  return (await response.json()).data.accessToken
}
async function call(token, method, path, data) {
  return http.fetch(`${api}${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } })
}
async function browserLogin(page,email) {
  await page.goto(web+'/login')
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/dashboard$/)
}
try {
  await register('Ana Portafolio', ownerEmail)
  const member = await register('Bruno Portafolio', memberEmail)
  const ownerToken = await login(ownerEmail), memberToken = await login(memberEmail)
  const projectResponse = await call(ownerToken,'POST','/projects',{name:'Recorrido integral SYNKRO'})
  expect(projectResponse.status()).toBe(201)
  const project = (await projectResponse.json()).data
  expect((await call(ownerToken,'POST',`/projects/${project.id}/members`,{email:memberEmail})).status()).toBe(201)
  const created = await call(ownerToken,'POST',`/tasks/project/${project.id}`,{title:'Validar entrega sintética',assigneeId:member.id,dueDate:new Date(Date.now()+3*86400000).toISOString()})
  expect(created.status()).toBe(201)
  const task = (await created.json()).data
  await expect.poll(async()=> {
    const messages = await (await http.get(mail+'/api/v1/messages')).json()
    return messages.messages.some(message=>message.To.some(to=>to.Address===memberEmail))
  },{timeout:60000}).toBe(true)
  expect((await call(memberToken,'GET',`/tasks/${task.id}`)).status()).toBe(200)
  expect((await call(memberToken,'PUT',`/tasks/${task.id}`,{title:'No permitido',expectedVersion:1})).status()).toBe(403)
  expect((await call(ownerToken,'PATCH',`/projects/${project.id}/members/${member.id}/permissions`,{canCreateTasks:false,canEditTasks:true})).status()).toBe(200)
  const ownerContext = await browser.newContext(), memberContext = await browser.newContext()
  const first = await ownerContext.newPage(), second = await memberContext.newPage()
  await browserLogin(first,ownerEmail); await browserLogin(second,memberEmail)
  for (const page of [first,second]) { await page.goto(`${web}/projects/${project.id}`); await page.getByTitle('Editar tarea',{exact:true}).click() }
  const a = first.getByRole('dialog',{name:'Editar tarea'}), b = second.getByRole('dialog',{name:'Editar tarea'})
  await a.getByLabel('Título de la tarea').fill('Revisión de Ana')
  await b.getByLabel('Título de la tarea').fill('Revisión de Bruno')
  await a.getByRole('button',{name:/Guardar cambios/}).click(); await expect(a).not.toBeVisible()
  await b.getByRole('button',{name:/Guardar cambios/}).click()
  await expect(b.getByRole('alert')).toContainText('Esta tarea cambió')
  await expect(b.getByLabel('Título de la tarea')).toHaveValue('Revisión de Bruno')
  await b.getByRole('button',{name:'Revisar y reaplicar mis cambios'}).click()
  await b.getByRole('button',{name:'Confirmar cambios revisados'}).click()
  await expect(b).not.toBeVisible()
  await second.getByRole('button',{name:'Actividad de Revisión de Bruno',exact:true}).click()
  const activity = second.getByRole('region',{name:'Actividad de la tarea'})
  await expect(activity).toContainText('Ana Portafolio'); await expect(activity).toContainText('Bruno Portafolio')
  await expect(second.getByText('Tarea actualizada.',{exact:true})).not.toBeVisible({timeout:6000})
  await mkdir('../docs/screenshots',{recursive:true})
  for (const [name,width,height] of [['desktop',1440,1000],['tablet',820,1180],['mobile',390,844]]) {
    await second.setViewportSize({width,height})
    await second.screenshot({path:`../docs/screenshots/${name}.png`,fullPage:true})
    if (width < 1001) {
      await second.getByRole('button',{name:'Menú de navegación',exact:true}).click()
      await expect(second.getByRole('link',{name:'📋 Mis Tareas',exact:true})).toBeVisible()
      await second.getByRole('button',{name:'Menú de navegación',exact:true}).click()
    }
    const overflow = await second.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)
    expect(overflow, `desbordamiento ${name}`).toBe(false)
  }
  await second.goto(web+'/tasks')
  await second.getByRole('button',{name:/Kanban/}).click()
  await second.getByText('Cambiar estado con teclado',{exact:true}).click()
  const status = second.getByLabel('Estado en tablero de Revisión de Bruno')
  await status.focus(); await second.keyboard.press('End'); await second.keyboard.press('Enter')
  // Chromium selecciona con teclado; esperar confirmación de la API.
  await expect.poll(async()=> (await (await call(memberToken,'GET',`/tasks/${task.id}`)).json()).data.status).toBe('COMPLETED')
  const current = (await (await call(ownerToken,'GET',`/tasks/${task.id}`)).json()).data
  expect((await call(ownerToken,'PUT',`/tasks/${task.id}`,{expectedVersion:current.version,dueDate:new Date(Date.now()-60000).toISOString()})).status()).toBe(200)
  const before = (await (await http.get(mail+'/api/v1/messages')).json()).total
  await new Promise(resolve=>setTimeout(resolve,17000))
  expect((await (await http.get(mail+'/api/v1/messages')).json()).total).toBe(before)
  expect((await call(ownerToken,'DELETE',`/projects/${project.id}/members/${member.id}`)).status()).toBe(200)
  expect((await call(memberToken,'GET',`/tasks/${task.id}`)).status()).toBe(404)
  console.log('PASS recorrido Compose: proyecto, miembros/permisos, asignación SMTP, conflicto/historial, teclado Kanban, exclusión de completada y revocación; 3 tamaños sin desbordamiento.')
  await ownerContext.close(); await memberContext.close()
} finally { await browser.close(); await http.dispose() }
