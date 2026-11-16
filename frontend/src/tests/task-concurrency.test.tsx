import { useState } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ProjectDetail from '../pages/ProjectDetail'
import Tasks from '../pages/Tasks'
import TaskActivity from '../components/TaskActivity'
import { useTaskStatus } from '../hooks/useTaskStatus'
import api from '../services/api'
import type { Task } from '../types'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav>SYNKRO</nav> }))
vi.mock('../context/authState', () => ({ useAuth: () => ({ user: { id: 1, name: 'Ana' } }) }))
const task = (id = 1, version = 1): Task => ({ id, version, title: `Tarea ${id}`, status: 'PENDING', priority: 'MEDIUM', projectId: 1, createdAt: '2026-01-01', updatedAt: '2026-01-01', canEdit: true })
const failure = (status: number) => ({ isAxiosError: true, response: { status, data: { error: 'Sin permiso' } } })
const conflict = (currentTask: Task) => ({ isAxiosError: true, response: { status: 409, data: { code: 'TASK_VERSION_CONFLICT', currentTask } } })
const response = (data: unknown) => ({ data: { data } })
const project = { id: 1, name: 'Proyecto', status: 'ACTIVE', tasks: [task()], members: [{ userId: 1, role: 'OWNER', user: { id: 1, name: 'Ana' } }] }
beforeEach(() => vi.resetAllMocks())
async function openEditor() {
  vi.mocked(api.get).mockResolvedValue(response(project))
  render(<MemoryRouter initialEntries={['/projects/1']}><Routes><Route path="/projects/:id" element={<ProjectDetail />} /></Routes></MemoryRouter>)
  fireEvent.click(await screen.findByTitle('Editar tarea'))
  const dialog = within(screen.getByRole('dialog', { name: 'Editar tarea' }))
  fireEvent.change(dialog.getByLabelText('Título de la tarea'), { target: { value: 'Mi borrador' } })
  return dialog
}
it('conserva borrador y versión inicial, compara y exige confirmar la reaplicación', async () => {
  const current = { ...task(1, 2), title: 'Cambio de Bruno', priority: 'HIGH' as const }
  vi.mocked(api.put).mockRejectedValueOnce(conflict(current)).mockResolvedValueOnce(response({ ...current, version: 3, title: 'Mi borrador' }))
  const dialog = await openEditor()
  fireEvent.click(dialog.getByRole('button', { name: /Guardar cambios/ }))
  expect(await dialog.findByRole('alert')).toHaveFocus()
  expect(api.put).toHaveBeenCalledWith('/tasks/1', { expectedVersion: 1, title: 'Mi borrador' })
  expect(dialog.getByLabelText('Título de la tarea')).toHaveValue('Mi borrador')
  expect(dialog.getByText('Actual: Cambio de Bruno')).toBeInTheDocument()
  fireEvent.click(dialog.getByRole('button', { name: 'Revisar y reaplicar mis cambios' }))
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(dialog.getByLabelText('Título de la tarea')).toHaveFocus()
  fireEvent.click(dialog.getByRole('button', { name: 'Confirmar cambios revisados' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(api.put).toHaveBeenLastCalledWith('/tasks/1', { expectedVersion: 2, title: 'Mi borrador' })
})
it('descartar es explícito y no escribe', async () => {
  vi.mocked(api.put).mockRejectedValue(conflict({ ...task(1, 2), title: 'Actual' }))
  const dialog = await openEditor()
  fireEvent.click(dialog.getByRole('button', { name: /Guardar cambios/ }))
  fireEvent.click(await dialog.findByRole('button', { name: 'Cargar versión actual y descartar mis cambios' }))
  expect(dialog.getByLabelText('Título de la tarea')).toHaveValue('Actual')
  expect(api.put).toHaveBeenCalledTimes(1)
})
it('detalle bloquea otro cambio de estado tras perder permiso, aunque la membresía local esté desactualizada', async () => {
  vi.mocked(api.get).mockResolvedValue(response(project))
  vi.mocked(api.patch).mockRejectedValue(failure(403))
  render(<MemoryRouter initialEntries={['/projects/1']}><Routes><Route path="/projects/:id" element={<ProjectDetail />} /></Routes></MemoryRouter>)
  const select = await screen.findByLabelText('Estado de Tarea 1')
  fireEvent.change(select, { target: { value: 'COMPLETED' } })
  await screen.findByRole('alert')
  expect(select).toBeDisabled()
  expect(screen.queryByTitle('Editar tarea')).not.toBeInTheDocument()
  expect(api.patch).toHaveBeenCalledTimes(1)
})
it.each([403, 404])('rechazo %s conserva texto y bloquea nuevos envíos', async status => {
  vi.mocked(api.put).mockRejectedValue(failure(status))
  const dialog = await openEditor()
  fireEvent.click(dialog.getByRole('button', { name: /Guardar cambios/ }))
  await dialog.findByRole('alert')
  expect(dialog.getByLabelText('Título de la tarea')).toHaveValue('Mi borrador')
  expect(dialog.getByRole('button', { name: /Guardar cambios/ })).toBeDisabled()
})
function useBoard() {
  const [tasks, setTasks] = useState([task(), task(2)])
  return { tasks, setTasks, ...useTaskStatus(tasks, setTasks) }
}
it('solo permite una escritura por tarea y usa la versión recibida en el próximo cambio', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  vi.mocked(api.patch).mockReturnValueOnce(new Promise(done => { resolve = done })).mockResolvedValue(response({ ...task(1, 3), status: 'COMPLETED' }))
  const { result } = renderHook(useBoard)
  let saving!: Promise<void>
  act(() => { saving = result.current.changeStatus(1, 'IN_PROGRESS') })
  await act(async () => { await result.current.changeStatus(1, 'COMPLETED') })
  expect(api.patch).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(response({ ...task(1, 2), status: 'IN_PROGRESS' })); await saving })
  await act(async () => { await result.current.changeStatus(1, 'COMPLETED') })
  expect(api.patch).toHaveBeenLastCalledWith('/tasks/1/status', { status: 'COMPLETED', expectedVersion: 2 })
})
it('409 reconcilia únicamente su tarea y no revierte otra modificación', async () => {
  vi.mocked(api.patch).mockImplementation(url => url.includes('/1/') ? Promise.reject(conflict({ ...task(1, 3), status: 'COMPLETED' })) : Promise.resolve(response({ ...task(2, 2), status: 'IN_PROGRESS' })))
  const { result } = renderHook(useBoard)
  await act(async () => { await Promise.all([result.current.changeStatus(1, 'IN_PROGRESS'), result.current.changeStatus(2, 'IN_PROGRESS')]) })
  expect(result.current.tasks.map(t => [t.version, t.status])).toEqual([[3, 'COMPLETED'], [2, 'IN_PROGRESS']])
  expect(result.current.mutationError).toContain('versión actual')
})
it('una respuesta tardía no sustituye una versión superior', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  vi.mocked(api.patch).mockReturnValue(new Promise(done => { resolve = done }))
  const { result } = renderHook(useBoard)
  let saving!: Promise<void>
  act(() => { saving = result.current.changeStatus(1, 'IN_PROGRESS') })
  act(() => { result.current.setTasks([{ ...task(1, 3), status: 'COMPLETED' }, task(2)]) })
  await act(async () => { resolve(response({ ...task(1, 2), status: 'IN_PROGRESS' })); await saving })
  expect(result.current.tasks[0]).toMatchObject({ version: 3, status: 'COMPLETED' })
})
it('red incierta consulta, bloquea y nunca repite automáticamente la mutación', async () => {
  vi.mocked(api.patch).mockRejectedValue(new Error('offline'))
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ ...task(1, 2), status: 'COMPLETED' }))
  const { result } = renderHook(useBoard)
  await act(async () => { await result.current.changeStatus(1, 'COMPLETED') })
  expect(result.current.tasks[0].uncertain).toBe(true)
  await act(async () => { await result.current.changeStatus(1, 'IN_PROGRESS') })
  expect(api.patch).toHaveBeenCalledTimes(1)
  await act(async () => { await result.current.checkTask(1) })
  expect(result.current.tasks[0]).toMatchObject({ version: 2, uncertain: false, status: 'COMPLETED' })
})
it('descarta una consulta iniciada antes de guardar', async () => {
  let resolve!: (value: ReturnType<typeof response>) => void
  vi.mocked(api.get).mockResolvedValueOnce(response([task()])).mockReturnValueOnce(new Promise(done => { resolve = done }))
  vi.mocked(api.patch).mockResolvedValue(response({ ...task(1, 2), status: 'COMPLETED' }))
  render(<MemoryRouter><Tasks /></MemoryRouter>)
  const select = await screen.findByLabelText('Estado de Tarea 1')
  fireEvent(window, new Event('focus'))
  fireEvent.change(select, { target: { value: 'COMPLETED' } })
  await waitFor(() => expect(select).not.toBeDisabled())
  await act(async () => { resolve(response([task()])) })
  expect(select).toHaveValue('COMPLETED')
})
it('actividad muestra carga, diferencias legibles, contenido seguro y paginación', async () => {
  const entry = { id: 1, actorName: 'Bruno', user: { id: 2, name: 'Bruno' }, createdAt: '2026-01-01', previousVersion: 1, resultingVersion: 2, reason: null, changes: { status: { before: 'PENDING', after: 'COMPLETED' }, description: { before: null, after: '<script>bad()</script>' } } }
  vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [entry], pagination: { totalPages: 2 } } }).mockResolvedValueOnce({ data: { data: [{ ...entry, id: 2, changes: null, description: 'Registro previo' }], pagination: { totalPages: 2 } } })
  const { container } = render(<TaskActivity taskId={1} version={2} />)
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  await screen.findByText('Bruno')
  expect(screen.getByText('Completada')).toBeInTheDocument()
  expect(screen.getByText('<script>bad()</script>')).toBeInTheDocument()
  expect(container.querySelector('script')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Actividad siguiente' }))
  await screen.findByText('Evento antiguo: Registro previo')
  expect(api.get).toHaveBeenLastCalledWith('/tasks/1/activity?page=2&limit=10')
})
it('actividad permite reintentar un error y comunica historial vacío', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: [], pagination: { totalPages: 0 } } })
  render(<TaskActivity taskId={1} version={1} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar actividad' }))
  await screen.findByText('Sin actividad registrada')
})
