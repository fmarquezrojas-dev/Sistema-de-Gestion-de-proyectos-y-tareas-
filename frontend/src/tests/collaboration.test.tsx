import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Tasks from '../pages/Tasks'
import ProjectDetail from '../pages/ProjectDetail'
import TaskComments from '../components/TaskComments'
import KanbanBoard from '../components/KanbanBoard'
import api from '../services/api'
import type { Task } from '../types'

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../components/Navbar', () => ({ default: () => <nav>SYNKRO</nav> }))
vi.mock('../context/authState', () => ({ useAuth: () => ({ user: { id: 1, name: 'Miembro' } }) }))
const task = (id: number, canEdit = true): Task => ({
  id, version: 1, title: `Tarea ${id}`, priority: 'MEDIUM', status: 'PENDING', projectId: 1,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', canEdit,
})
const denied = { isAxiosError: true, response: { status: 403, data: { error: 'No tienes permiso para editar tareas' } } }
beforeEach(() => { vi.resetAllMocks() })

it('revierte solo la tarea rechazada, conserva otro cambio y muestra el error', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [task(1), task(2)] } })
  let rejectFirst!: (reason: unknown) => void
  vi.mocked(api.patch).mockImplementation(url => url.includes('/1/')
    ? new Promise((_resolve, reject) => { rejectFirst = reject })
    : Promise.resolve({ data: { data: { ...task(2), version: 2, status: 'COMPLETED' } } }))
  render(<MemoryRouter><Tasks /></MemoryRouter>)
  const first = await screen.findByLabelText('Estado de Tarea 1')
  fireEvent.change(first, { target: { value: 'IN_PROGRESS' } })
  expect(first).toHaveValue('IN_PROGRESS')
  expect(first).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Estado de Tarea 2'), { target: { value: 'COMPLETED' } })
  await waitFor(() => expect(screen.getByLabelText('Estado de Tarea 2')).not.toBeDisabled())
  await act(async () => rejectFirst(denied))
  expect(first).toHaveValue('PENDING')
  expect(first).toBeDisabled()
  expect(screen.getByLabelText('Estado de Tarea 2')).toHaveValue('COMPLETED')
  expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso para editar tareas')
  expect(api.get).toHaveBeenCalledTimes(1)
})
it('no ofrece cambios de estado a un miembro sin permiso', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [task(1, false)] } })
  render(<MemoryRouter><Tasks /></MemoryRouter>)
  expect(await screen.findByLabelText('Estado de Tarea 1')).toBeDisabled()
  expect(api.patch).not.toHaveBeenCalled()
})
it('Kanban desactiva arrastre al revocar el permiso', () => {
  const onStatusChange = vi.fn()
  const { rerender } = render(<KanbanBoard tasks={[task(1)]} now={new Date()} onStatusChange={onStatusChange} />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'false')
  rerender(<KanbanBoard tasks={[task(1, false)]} now={new Date()} onStatusChange={onStatusChange} />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
})
it('un 404 durante una mutación retira la tarea inaccesible', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [task(1), task(2)] } })
  vi.mocked(api.patch).mockRejectedValue({ isAxiosError: true, response: { status: 404 } })
  render(<MemoryRouter><Tasks /></MemoryRouter>)
  fireEvent.change(await screen.findByLabelText('Estado de Tarea 1'), { target: { value: 'COMPLETED' } })
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Estado de Tarea 1')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Estado de Tarea 2')).toBeInTheDocument()
})
it('miembro sin permiso de edición puede comentar; OWNER puede moderar', async () => {
  const comment = { id: 5, content: 'De otro miembro', createdAt: new Date().toISOString(), user: { id: 2, name: 'Otro', avatarColor: '#123', avatarUrl: null } }
  vi.mocked(api.get).mockResolvedValue({ data: { data: [comment] } })
  vi.mocked(api.post).mockResolvedValue({ data: { data: { ...comment, id: 6, content: 'Nuevo' } } })
  const { rerender } = render(<TaskComments taskId={1} currentUser={{ id: 1, name: 'Miembro' }} />)
  await screen.findByText('De otro miembro')
  expect(screen.queryByTitle('Eliminar comentario')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nuevo' } })
  fireEvent.click(screen.getByRole('button', { name: /Enviar/ }))
  await screen.findByText('Nuevo')
  expect(api.post).toHaveBeenCalledWith('/tasks/1/comments', { content: 'Nuevo' })
  rerender(<TaskComments taskId={1} currentUser={{ id: 1, name: 'Miembro' }} canModerate />)
  expect(screen.getAllByTitle('Eliminar comentario')).toHaveLength(2)
})
it('detalle refleja permisos revocados mientras está abierto', async () => {
  let canEditTasks = true
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: {
    id: 1, name: 'Proyecto A', status: 'ACTIVE', tasks: [task(1)],
    members: [{ userId: 1, role: 'MEMBER', canCreateTasks: false, canEditTasks, user: { id: 1, name: 'Miembro' } }],
  } } }))
  render(<MemoryRouter initialEntries={['/projects/1']}><Routes><Route path="/projects/:id" element={<ProjectDetail />} /></Routes></MemoryRouter>)
  expect(await screen.findByTitle('Editar tarea')).toBeInTheDocument()
  expect(screen.queryByTitle('Eliminar tarea')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Estado de Tarea 1')).not.toBeDisabled()
  canEditTasks = false
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(screen.queryByTitle('Editar tarea')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Estado de Tarea 1')).toBeDisabled()
})

it('retirar un miembro recarga miembros y responsables visibles', async () => {
  let removed = false
  const other = { id: 2, name: 'Otra persona', email: 'other@example.invalid', role: 'MEMBER' }
  vi.mocked(api.get).mockImplementation(async () => ({ data: { data: {
    id: 1, name: 'Proyecto A', status: 'ACTIVE',
    tasks: [{ ...task(1), assigneeId: removed ? null : 2, assignee: removed ? null : other }],
    members: [
      { userId: 1, role: 'OWNER', user: { id: 1, name: 'Miembro' } },
      ...(!removed ? [{ userId: 2, role: 'MEMBER', user: other }] : []),
    ],
  } } }))
  vi.mocked(api.delete).mockImplementation(async () => { removed = true; return { data: {} } })
  render(<MemoryRouter initialEntries={['/projects/1']}><Routes><Route path="/projects/:id" element={<ProjectDetail />} /></Routes></MemoryRouter>)
  fireEvent.click(await screen.findByTitle('Quitar miembro'))
  fireEvent.click(screen.getByRole('button', { name: 'Quitar miembro' }))
  await waitFor(() => expect(screen.queryByTitle('Quitar miembro')).not.toBeInTheDocument())
  expect(screen.queryAllByText('Otra persona')).toHaveLength(0)
  expect(api.delete).toHaveBeenCalledWith('/projects/1/members/2')
})
