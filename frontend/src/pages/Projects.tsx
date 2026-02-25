import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import api from '../services/api'
import type { Project } from '../types'

const statusColor: Record<string, string> = {
  ACTIVE: '#22c55e',
  PAUSED: '#f59e0b',
  COMPLETED: '#6b7280'
}

const statusLabel: Record<string, string> = {
  ACTIVE: 'Activo',
  PAUSED: 'Pausado',
  COMPLETED: 'Completado'
}

const Projects = () => {
  const { logout } = useAuth()
  const navigate = useNavigate()
  
  // El hook ahora ya devuelve el array directamente en 'data'
  const { data: projects, loading, error, fetch } = useApi<Project[]>('/projects')

  // Proyectos es un array o, si es null al inicio, un array vacío
  const projectsList = Array.isArray(projects) ? projects : [];

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { fetch() }, [fetch])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/projects', form)
      setForm({ name: '', description: '' })
      setShowForm(false)
      fetch()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al crear proyecto')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={styles.container}>
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
        <div style={styles.pageHeader}>
          <h1 style={styles.title}>📁 Proyectos</h1>
          <button onClick={() => setShowForm(!showForm)} style={styles.createBtn}>
            {showForm ? 'Cancelar' : '+ Nuevo Proyecto'}
          </button>
        </div>

        {/* Formulario crear proyecto */}
        {showForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Nuevo Proyecto</h3>
            <form onSubmit={handleCreate}>
              <div style={styles.field}>
                <label style={styles.label}>Nombre</label>
                <input
                  style={styles.input}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre del proyecto"
                  required
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Descripción</label>
                <textarea
                  style={{ ...styles.input, height: '80px', resize: 'vertical' }}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción opcional"
                />
              </div>
              <button style={styles.submitBtn} type="submit" disabled={creating}>
                {creating ? 'Creando...' : 'Crear Proyecto'}
              </button>
            </form>
          </div>
        )}

        {loading && <p style={styles.empty}>Cargando proyectos...</p>}
        {error && <p style={{ color: '#ef4444' }}>Error: {error}</p>}

        {/* Lista de proyectos */}
       <div style={styles.grid}>
  {projectsList.length === 0 && !loading && (
    <p style={styles.empty}>No tienes proyectos aún. ¡Crea el primero!</p>
  )}
  {projectsList.map((project: Project) => (
    <Link to={`/projects/${project.id}`} key={project.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{project.name}</h3>
                <span style={{ ...styles.statusBadge, background: statusColor[project.status] }}>
                  {statusLabel[project.status]}
                </span>
              </div>
              {project.description && (
                <p style={styles.description}>{project.description}</p>
              )}
              <div style={styles.cardFooter}>
                <span style={styles.footerText}>
                  👥 {project.members?.length || 0} miembros
                </span>
                <span style={styles.footerText}>
                  📋 {project._count?.tasks || 0} tareas
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#f0f2f5' },
  navbar: { background: '#1a1a2e', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: '#fff', fontSize: '1.2rem' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
  navLink: { color: '#ccc', fontSize: '0.9rem' },
  logoutBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' },
  content: { padding: '2rem', maxWidth: '1100px', margin: '0 auto' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a2e' },
  createBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  formCard: { background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem' },
  formTitle: { fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#1a1a2e' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' },
  input: { width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit' },
  submitBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' },
  card: { background: '#fff', borderRadius: '8px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', textDecoration: 'none', color: '#333', display: 'block', transition: 'transform 0.15s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' },
  cardTitle: { fontSize: '1rem', fontWeight: 600, color: '#1a1a2e' },
  statusBadge: { fontSize: '0.72rem', color: '#fff', padding: '0.2rem 0.65rem', borderRadius: '999px', whiteSpace: 'nowrap' },
  description: { fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 },
  cardFooter: { display: 'flex', gap: '1rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.75rem' },
  footerText: { fontSize: '0.8rem', color: '#888' },
  empty: { color: '#999', textAlign: 'center', padding: '2rem' }
}

export default Projects