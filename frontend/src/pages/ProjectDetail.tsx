import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import type { Project, Task } from '../types'

const priorityColor: Record<string, string> = {
  HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#22c55e'
}
const priorityLabel: Record<string, string> = {
  HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja'
}
const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', COMPLETED: 'Completada'
}
const statusColor: Record<string, string> = {
  PENDING: '#fef9c3', IN_PROGRESS: '#dbeafe', COMPLETED: '#dcfce7'
}
const statusTextColor: Record<string, string> = {
  PENDING: '#854d0e', IN_PROGRESS: '#1d4ed8', COMPLETED: '#16a34a'
}

// ✅ Componente Toast moderno
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: { bg: '#f0fdf4', border: '#22c55e', icon: '✅', text: '#15803d' },
    error: { bg: '#fef2f2', border: '#ef4444', icon: '❌', text: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', text: '#d97706' }
  }
  const c = colors[type]

  return (
    <div style={{
      position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1000,
      background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.border}`,
      borderRadius: '8px', padding: '1rem 1.25rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '280px', maxWidth: '400px',
      animation: 'slideIn 0.3s ease'
    }}>
      <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
      <p style={{ margin: 0, fontSize: '0.9rem', color: c.text, fontWeight: 500, flex: 1 }}>{message}</p>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, fontSize: '1rem', opacity: 0.6 }}>✕</button>
    </div>
  )
}

// ✅ Modal de confirmación moderno
const ConfirmModal = ({ message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger = false }: {
  message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string; danger?: boolean
}) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '2rem', maxWidth: '400px', width: '90%',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
    }}>
      <p style={{ fontSize: '1rem', color: '#1a1a2e', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '0.5rem 1.25rem', borderRadius: '6px', border: '1px solid #ddd',
          background: '#fff', cursor: 'pointer', fontSize: '0.9rem'
        }}>Cancelar</button>
        <button onClick={onConfirm} style={{
          padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
          background: danger ? '#ef4444' : '#4f46e5', color: '#fff',
          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600
        }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
)

const ProjectDetail = () => {
  const { id } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project & { tasks: Task[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' })
  const [creating, setCreating] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '' })
  const [editing, setEditing] = useState(false)

  // ✅ Toast y Modal
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void; confirmLabel?: string; danger?: boolean } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type })
  }

  const showConfirm = (message: string, onConfirm: () => void, confirmLabel = 'Confirmar', danger = false) => {
    setConfirm({ message, onConfirm, confirmLabel, danger })
  }

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`)
      const raw = res.data?.data ?? res.data
      setProject({ ...raw, tasks: raw.tasks || [] })
    } catch {
      navigate('/projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProject() }, [id])

  // ✅ Detectar si el usuario actual es Owner
  const currentMember = project?.members?.find((m: any) => m.userId === user?.id)
  const isOwner = currentMember?.role === 'OWNER'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailToInvite = inviteEmail.trim().toLowerCase()
    if (!emailToInvite) return
    setInviting(true)
    try {
      await api.post(`/projects/${id}/members`, { email: emailToInvite })
      showToast('¡Usuario invitado con éxito!')
      setInviteEmail('')
      fetchProject()
    } catch (err: any) {
      const status = err.response?.status
      if (status === 404) showToast('El usuario no está registrado en el sistema.', 'error')
      else if (status === 409) showToast('Este usuario ya pertenece al proyecto.', 'warning')
      else showToast(err.response?.data?.error || 'No se pudo invitar al usuario.', 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = (memberId: number, memberName: string) => {
    showConfirm(
      `¿Quitar a ${memberName} del proyecto?`,
      async () => {
        setConfirm(null)
        setRemovingId(memberId)
        try {
          await api.delete(`/projects/${id}/members/${memberId}`)
          showToast(`${memberName} fue removido del proyecto.`)
          fetchProject()
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Error al quitar miembro', 'error')
        } finally {
          setRemovingId(null)
        }
      },
      'Quitar miembro', true
    )
  }

  // ✅ Abandonar proyecto (para miembros no-owner)
  const handleLeaveProject = () => {
    showConfirm(
      '¿Estás seguro de que quieres abandonar este proyecto? Ya no tendrás acceso a él.',
      async () => {
        setConfirm(null)
        try {
          await api.delete(`/projects/${id}/members/${user?.id}`)
          showToast('Abandonaste el proyecto.')
          setTimeout(() => navigate('/projects'), 1500)
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Error al abandonar proyecto', 'error')
        }
      },
      'Abandonar proyecto', true
    )
  }

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditing(true)
    try {
      await api.put(`/projects/${id}`, editForm)
      setShowEditForm(false)
      showToast('Proyecto actualizado correctamente.')
      fetchProject()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al editar proyecto', 'error')
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteProject = () => {
    showConfirm(
      '¿Eliminar este proyecto? Esta acción no se puede deshacer y se perderán todas las tareas.',
      async () => {
        setConfirm(null)
        try {
          await api.delete(`/projects/${id}`)
          navigate('/projects')
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Error al eliminar proyecto', 'error')
        }
      },
      'Eliminar proyecto', true
    )
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post(`/tasks/project/${id}`, {
        ...taskForm,
        assigneeId: taskForm.assigneeId ? Number(taskForm.assigneeId) : undefined
      })
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assigneeId: '' })
      setShowTaskForm(false)
      showToast('Tarea creada correctamente.')
      fetchProject()
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al crear tarea', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status })
      fetchProject()
    } catch {
      showToast('Error al actualizar tarea', 'error')
    }
  }

  const handleDeleteTask = (taskId: number) => {
    showConfirm('¿Eliminar esta tarea?', async () => {
      setConfirm(null)
      try {
        await api.delete(`/tasks/${taskId}`)
        showToast('Tarea eliminada.')
        fetchProject()
      } catch {
        showToast('Error al eliminar tarea', 'error')
      }
    }, 'Eliminar', true)
  }

  if (loading) return <div style={styles.center}>Cargando proyecto...</div>
  if (!project) return null

  const filteredTasks = filterStatus
    ? project.tasks.filter(t => t.status === filterStatus)
    : project.tasks

  const completedCount = project.tasks.filter(t => t.status === 'COMPLETED').length
  const progress = project.tasks.length > 0
    ? Math.round((completedCount / project.tasks.length) * 100)
    : 0

  return (
    <div style={styles.container}>
      {/* Toast moderno */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Modal de confirmación moderno */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
        />
      )}

      <nav style={styles.navbar}>
        <h2 style={styles.logo}>🚀 ProjectManager</h2>
        <div style={styles.navLinks}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          <Link to="/projects" style={styles.navLink}>Proyectos</Link>
          <Link to="/tasks" style={styles.navLink}>Mis Tareas</Link>
            <Link to="/profile" style={styles.navLink}>Mi Perfil</Link>
          <button onClick={handleLogout} style={styles.logoutBtn}>Salir</button>
        </div>
      </nav>

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.projectHeader}>
          <div>
            <Link to="/projects" style={styles.back}>← Volver a Proyectos</Link>
            <h1 style={styles.title}>{project.name}</h1>
            {project.description && <p style={styles.description}>{project.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
            {/* ✅ Solo Owner ve Editar y Eliminar */}
            {isOwner ? (
              <>
                <button
                  onClick={() => {
                    setEditForm({ name: project.name, description: project.description || '', status: project.status })
                    setShowEditForm(!showEditForm)
                  }}
                  style={styles.editBtn}
                >
                  ✏️ Editar
                </button>
                <button onClick={handleDeleteProject} style={styles.deleteBtn}>
                  🗑️ Eliminar
                </button>
              </>
            ) : (
              // ✅ Miembros ven "Abandonar proyecto"
              <button onClick={handleLeaveProject} style={styles.leaveBtn}>
                🚪 Abandonar proyecto
              </button>
            )}
          </div>
        </div>

        {/* Formulario editar proyecto — solo Owner */}
        {isOwner && showEditForm && (
          <div style={styles.formCard}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1a1a2e' }}>
              Editar Proyecto
            </h3>
            <form onSubmit={handleEditProject}>
              <div style={styles.formRow}>
                <div style={{ ...styles.field, flex: 2 }}>
                  <label style={styles.label}>Nombre</label>
                  <input style={styles.input} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Estado</label>
                  <select style={styles.input} value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                    <option value="ACTIVE">Activo</option>
                    <option value="PAUSED">Pausado</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Descripción</label>
                <textarea style={{ ...styles.input, height: '60px', resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button style={styles.submitBtn} type="submit" disabled={editing}>
                  {editing ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setShowEditForm(false)} style={{ ...styles.submitBtn, background: '#6b7280' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Progreso */}
        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>Progreso general</span>
            <span style={styles.progressPct}>{progress}%</span>
          </div>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%`, background: progress === 100 ? '#22c55e' : '#4f46e5' }} />
          </div>
          <div style={styles.progressStats}>
            <span>📋 {project.tasks.length} tareas totales</span>
            <span>✅ {completedCount} completadas</span>
            <span>👥 {project.members?.length} miembros</span>
          </div>
        </div>

        <div style={styles.grid}>
          {/* Tareas */}
          <div style={{ flex: 2 }}>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>📋 Tareas</h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="COMPLETED">Completadas</option>
                </select>
                <button onClick={() => setShowTaskForm(!showTaskForm)} style={styles.createBtn}>
                  {showTaskForm ? 'Cancelar' : '+ Tarea'}
                </button>
              </div>
            </div>

            {showTaskForm && (
              <div style={styles.formCard}>
                <form onSubmit={handleCreateTask}>
                  <div style={styles.formRow}>
                    <div style={{ ...styles.field, flex: 2 }}>
                      <label style={styles.label}>Título</label>
                      <input style={styles.input} value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Título de la tarea" required />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Prioridad</label>
                      <select style={styles.input} value={taskForm.priority} onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}>
                        <option value="LOW">Baja</option>
                        <option value="MEDIUM">Media</option>
                        <option value="HIGH">Alta</option>
                      </select>
                    </div>
                  </div>
                  <div style={styles.formRow}>
                    <div style={styles.field}>
                      <label style={styles.label}>Fecha límite</label>
                      <input style={styles.input} type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
                    </div>
                    <div style={{ ...styles.field, flex: 2 }}>
                      <label style={styles.label}>Asignar a</label>
                      <select style={styles.input} value={taskForm.assigneeId} onChange={e => setTaskForm({ ...taskForm, assigneeId: e.target.value })}>
                        <option value="">Sin asignar</option>
                        {project.members?.map((m: any) => (
                          <option key={m.userId} value={m.userId}>
                            {m.user?.name} ({m.role === 'OWNER' ? 'Owner' : 'Member'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Descripción</label>
                    <textarea style={{ ...styles.input, height: '60px', resize: 'vertical' }} value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Descripción opcional" />
                  </div>
                  <button style={styles.submitBtn} type="submit" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear Tarea'}
                  </button>
                </form>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <p style={styles.empty}>No hay tareas {filterStatus ? 'con este filtro' : 'aún'}</p>
            )}

            {filteredTasks.map(task => (
              <div key={task.id} style={{ ...styles.taskCard, borderLeft: `4px solid ${priorityColor[task.priority]}` }}>
                <div style={styles.taskHeader}>
                  <div>
                    <p style={styles.taskTitle}>{task.title}</p>
                    {task.description && <p style={styles.taskDesc}>{task.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ ...styles.priorityBadge, background: priorityColor[task.priority] }}>
                      {priorityLabel[task.priority]}
                    </span>
                    <button onClick={() => handleDeleteTask(task.id)} style={styles.iconBtn}>🗑</button>
                  </div>
                </div>
                <div style={styles.taskFooter}>
                  <select
                    style={{ ...styles.statusSelect, background: statusColor[task.status], color: statusTextColor[task.status] }}
                    value={task.status}
                    onChange={e => handleStatusChange(task.id, e.target.value)}
                  >
                    <option value="PENDING">{statusLabel['PENDING']}</option>
                    <option value="IN_PROGRESS">{statusLabel['IN_PROGRESS']}</option>
                    <option value="COMPLETED">{statusLabel['COMPLETED']}</option>
                  </select>
                  {task.dueDate && (
                    <span style={styles.dueDate}>📅 {new Date(task.dueDate).toLocaleDateString('es-PE')}</span>
                  )}
                  {task.assignee && (
                    <span style={styles.assigneeBadge}>👤 {task.assignee.name}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Panel miembros */}
          <div style={{ flex: 1 }}>
            <div style={styles.membersCard}>
              <h2 style={styles.sectionTitle}>👥 Miembros</h2>

              {/* Solo Owner puede invitar */}
              {isOwner && (
                <form onSubmit={handleInvite} style={styles.inviteForm}>
                  <input
                    style={styles.inviteInput}
                    type="email"
                    placeholder="Email del colaborador"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={inviting} style={styles.inviteBtn}>
                    {inviting ? '...' : 'Invitar'}
                  </button>
                </form>
              )}

              {project.members?.map((member: any) => (
                <div key={member.userId} style={styles.memberItem}>
                  <div style={styles.avatar}>
                    {member.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={styles.memberName}>{member.user?.name}</p>
                    <p style={styles.memberEmail}>{member.user?.email}</p>
                  </div>
                  {member.role === 'OWNER'
                    ? <span style={styles.ownerBadge}>Owner</span>
                    : isOwner && (
                      <button
                        onClick={() => handleRemoveMember(member.userId, member.user?.name)}
                        disabled={removingId === member.userId}
                        style={styles.removeMemberBtn}
                        title="Quitar miembro"
                      >
                        {removingId === member.userId ? '...' : '✕'}
                      </button>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  navbar: { background: '#1a1a2e', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: '#fff', fontSize: '1.2rem' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  navLink: { color: '#ccc', fontSize: '0.9rem' },
  logoutBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
  content: { padding: '2rem', maxWidth: '1100px', margin: '0 auto' },
  projectHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  back: { fontSize: '0.85rem', color: '#4f46e5', display: 'block', marginBottom: '0.5rem' },
  title: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.3rem' },
  description: { fontSize: '0.9rem', color: '#666', maxWidth: '600px', margin: 0 },
  editBtn: { background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' },
  deleteBtn: { background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' },
  leaveBtn: { background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' },
  progressCard: { background: '#fff', padding: '1.25rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  progressHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' },
  progressLabel: { fontSize: '0.9rem', fontWeight: 500 },
  progressPct: { fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5' },
  progressBar: { height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.75rem' },
  progressFill: { height: '100%', borderRadius: '999px', transition: 'width 0.3s ease' },
  progressStats: { display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#666' },
  grid: { display: 'flex', gap: '1.5rem', alignItems: 'flex-start' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#1a1a2e', margin: 0 },
  select: { padding: '0.4rem 0.75rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem', background: '#fff' },
  createBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  formCard: { background: '#fff', padding: '1.25rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1rem' },
  formRow: { display: 'flex', gap: '1rem' },
  field: { marginBottom: '0.75rem', flex: 1 },
  label: { display: 'block', marginBottom: '0.3rem', fontWeight: 500, fontSize: '0.85rem' },
  input: { width: '100%', padding: '0.55rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' },
  submitBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  taskCard: { background: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '0.75rem', paddingLeft: '1.25rem' },
  taskHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' },
  taskTitle: { fontWeight: 500, fontSize: '0.95rem', color: '#1a1a2e', margin: 0 },
  taskDesc: { fontSize: '0.83rem', color: '#666', margin: '0.25rem 0 0' },
  taskFooter: { display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  priorityBadge: { fontSize: '0.7rem', color: '#fff', padding: '0.15rem 0.55rem', borderRadius: '999px', whiteSpace: 'nowrap' },
  statusSelect: { border: 'none', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
  dueDate: { fontSize: '0.8rem', color: '#888' },
  assigneeBadge: { fontSize: '0.78rem', color: '#4f46e5', background: '#e0e7ff', padding: '0.15rem 0.55rem', borderRadius: '999px' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.6 },
  membersCard: { background: '#fff', padding: '1.25rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  inviteForm: { display: 'flex', gap: '0.5rem', margin: '0.75rem 0 1rem' },
  inviteInput: { flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.85rem' },
  inviteBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' },
  memberItem: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid #f0f0f0' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 },
  memberName: { fontWeight: 500, fontSize: '0.88rem', margin: 0 },
  memberEmail: { fontSize: '0.78rem', color: '#888', margin: 0 },
  ownerBadge: { fontSize: '0.7rem', background: '#e0e7ff', color: '#4f46e5', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: 600, whiteSpace: 'nowrap' },
  removeMemberBtn: { background: '#fee2e2', color: '#ef4444', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  empty: { color: '#999', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }
}

export default ProjectDetail