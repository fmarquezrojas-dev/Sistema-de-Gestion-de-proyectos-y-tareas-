import { test, expect, type Page } from '@playwright/test'
const password = 'synthetic-collaboration-password'
async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.locator('input[type=password]').fill(password)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
}
test('dos integrantes conservan borradores, resuelven conflicto y consultan sus actores', async ({ browser, request }) => {
  const ownerEmail = `owner-${crypto.randomUUID()}@example.invalid`
  const memberEmail = `member-${crypto.randomUUID()}@example.invalid`
  let memberId = 0
  for (const [name, email] of [['Ana Synthetic', ownerEmail], ['Bruno Synthetic', memberEmail]]) {
    const registered = await request.post('http://localhost:3001/api/auth/register', {
      headers: { Origin: 'http://localhost:5174' }, data: { name, email, password },
    })
    expect(registered.status()).toBe(201)
    if (email === memberEmail) memberId = (await registered.json()).data.id
  }
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  try {
    const first = await firstContext.newPage(), second = await secondContext.newPage()
    await login(first, ownerEmail)
    await login(second, memberEmail)
    const { projectId, taskId } = await first.evaluate(async ({ memberEmail, memberId }) => {
      const path = '/src/services/api.ts'
      const { default: api } = await import(/* @vite-ignore */ path)
      const project = (await api.post('/projects', { name: 'Proyecto concurrente sintético' })).data.data
      await api.post(`/projects/${project.id}/members`, { email: memberEmail })
      await api.patch(`/projects/${project.id}/members/${memberId}/permissions`, { canCreateTasks: false, canEditTasks: true })
      const task = (await api.post(`/tasks/project/${project.id}`, { title: 'Original compartido' })).data.data
      return { projectId: project.id, taskId: task.id }
    }, { memberEmail, memberId })
    for (const page of [first, second]) {
      await page.goto(`/projects/${projectId}`)
      await page.getByTitle('Editar tarea', { exact: true }).click()
    }
    const firstDialog = first.getByRole('dialog', { name: 'Editar tarea' })
    const secondDialog = second.getByRole('dialog', { name: 'Editar tarea' })
    await firstDialog.getByLabel('Título de la tarea').fill('Cambio de Ana')
    await secondDialog.getByLabel('Título de la tarea').fill('Borrador de Bruno')
    await firstDialog.getByRole('button', { name: /Guardar cambios/ }).click()
    await expect(firstDialog).not.toBeVisible()
    const rejected = second.waitForResponse(r => r.url().endsWith(`/tasks/${taskId}`) && r.request().method() === 'PUT')
    await secondDialog.getByRole('button', { name: /Guardar cambios/ }).click()
    expect((await rejected).status()).toBe(409)
    await expect(secondDialog.getByRole('alert')).toContainText('Esta tarea cambió mientras la estabas editando')
    await expect(secondDialog.getByLabel('Título de la tarea')).toHaveValue('Borrador de Bruno')
    await secondDialog.getByText('Consultar versión actual', { exact: true }).click()
    await expect(secondDialog.getByText('Cambio de Ana', { exact: true })).toBeVisible()
    await secondDialog.getByRole('button', { name: 'Revisar y reaplicar mis cambios' }).click()
    await expect(secondDialog.getByRole('status')).toContainText('versión 2')
    await secondDialog.getByRole('button', { name: 'Confirmar cambios revisados' }).click()
    await expect(secondDialog).not.toBeVisible()
    await second.getByRole('button', { name: 'Actividad de Borrador de Bruno', exact: true }).click()
    const activity = second.getByRole('region', { name: 'Actividad de la tarea' })
    await expect(activity.getByText('Bruno Synthetic', { exact: true })).toBeVisible()
    await expect(activity.getByText('Ana Synthetic', { exact: true }).first()).toBeVisible()
    await expect(activity).toContainText('Versión 1 → 2')
    await expect(activity).toContainText('Versión 2 → 3')
    await expect(activity).toContainText('Cambio de Ana')
    await expect(activity).toContainText('Borrador de Bruno')
  } finally {
    await firstContext.close()
    await secondContext.close()
  }
})
