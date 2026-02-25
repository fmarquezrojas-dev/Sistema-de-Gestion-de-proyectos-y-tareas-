import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const Profile = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info')

  // Info form
  const [infoForm, setInfoForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [savingInfo, setSavingInfo] = useState(false)

  // Password form
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPass, setSavingPass] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingInfo(true)
    try {
      await api.put('/auth/profile', infoForm)
      showToast('Perfil actualizado correctamente.')
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al actualizar perfil', 'error')
    } finally {
      setSavingInfo(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'error')
      return
    }
    if (passForm.newPassword.length < 6) {
      showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error')
      return
    }
    setSavingPass(true)
    try {
      await api.put('/auth/password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      })
      showToast('Contraseña actualizada correctamente.')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al cambiar contraseña', 'error')
    } finally {
      setSavingPass(false)
    }
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div style={styles.container}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1000,
          background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`,
          borderLeft: `4px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`,
          borderRadius: '8px', padding: '1rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '280px'
        }}>
          <span>{toast.type === 'success' ? '✅' : '❌'}</span>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, color: toast.type === 'success' ? '#15803d' : '#dc2626' }}>
            {toast.message}
          </p>
        </div>
      )}

      <nav style={styles.navbar}>
        <h2 style={styles.logo}>🚀 ProjectManager</h2>
        <div style={styles.navLinks}>
          <Link to="/dashboard" style={styles.navLink}>Dashboard</Link>
          <Link to="/projects" style={styles.navLink}>Proyectos</Link>
          <Link to="/tasks" style={styles.navLink}>Mis Tareas</Link>
          <Link to="/profile" style={{ ...styles.navLink, color: '#fff', fontWeight: 600 }}>Mi Perfil</Link>
          <button onClick={handleLogout} style={styles.logoutBtn}>Salir</button>
        </div>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>Mi Perfil</h1>

        <div style={styles.grid}>
          {/* Panel izquierdo — Avatar y resumen */}
          <div style={styles.avatarCard}>
            <div style={styles.avatarCircle}>{initials}</div>
            <h2 style={styles.avatarName}>{user?.name}</h2>
            <p style={styles.avatarEmail}>{user?.email}</p>
            <span style={styles.roleBadge}>
              {user?.role === 'ADMIN' ? '👑 Admin' : '👤 Member'}
            </span>
            <div style={styles.divider} />
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Miembro desde</span>
              <span style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' }) : '—'}
              </span>
            </div>
          </div>

          {/* Panel derecho — Formularios */}
          <div style={{ flex: 1 }}>
            {/* Tabs */}
            <div style={styles.tabs}>
              <button
                style={{ ...styles.tab, ...(activeTab === 'info' ? styles.tabActive : {}) }}
                onClick={() => setActiveTab('info')}
              >
                ✏️ Información personal
              </button>
              <button
                style={{ ...styles.tab, ...(activeTab === 'password' ? styles.tabActive : {}) }}
                onClick={() => setActiveTab('password')}
              >
                🔒 Cambiar contraseña
              </button>
            </div>

            {/* Tab: Información personal */}
            {activeTab === 'info' && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Información personal</h3>
                <p style={styles.formSubtitle}>Actualiza tu nombre y email.</p>
                <form onSubmit={handleSaveInfo}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nombre completo</label>
                    <input
                      style={styles.input}
                      value={infoForm.name}
                      onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Email</label>
                    <input
                      style={styles.input}
                      type="email"
                      value={infoForm.email}
                      onChange={e => setInfoForm({ ...infoForm, email: e.target.value })}
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                  <button style={styles.submitBtn} type="submit" disabled={savingInfo}>
                    {savingInfo ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </form>
              </div>
            )}

            {/* Tab: Cambiar contraseña */}
            {activeTab === 'password' && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Cambiar contraseña</h3>
                <p style={styles.formSubtitle}>Usa una contraseña segura de al menos 6 caracteres.</p>
                <form onSubmit={handleChangePassword}>
                  <div style={styles.field}>
                    <label style={styles.label}>Contraseña actual</label>
                    <input
                      style={styles.input}
                      type="password"
                      value={passForm.currentPassword}
                      onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })}
                      placeholder="••••••"
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nueva contraseña</label>
                    <input
                      style={styles.input}
                      type="password"
                      value={passForm.newPassword}
                      onChange={e => setPassForm({ ...passForm, newPassword: e.target.value })}
                      placeholder="••••••"
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Confirmar nueva contraseña</label>
                    <input
                      style={styles.input}
                      type="password"
                      value={passForm.confirmPassword}
                      onChange={e => setPassForm({ ...passForm, confirmPassword: e.target.value })}
                      placeholder="••••••"
                      required
                    />
                  </div>
                  <button style={styles.submitBtn} type="submit" disabled={savingPass}>
                    {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </form>
              </div>
            )}
          </div>
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
  content: { padding: '2rem', maxWidth: '900px', margin: '0 auto' },
  pageTitle: { fontSize: '1.6rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '1.5rem' },
  grid: { display: 'flex', gap: '1.5rem', alignItems: 'flex-start' },
  avatarCard: { background: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px', flexShrink: 0 },
  avatarCircle: { width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700, marginBottom: '1rem' },
  avatarName: { fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.25rem', textAlign: 'center' },
  avatarEmail: { fontSize: '0.8rem', color: '#888', margin: '0 0 0.75rem', textAlign: 'center', wordBreak: 'break-all' },
  roleBadge: { fontSize: '0.78rem', background: '#e0e7ff', color: '#4f46e5', padding: '0.25rem 0.75rem', borderRadius: '999px', fontWeight: 600 },
  divider: { width: '100%', height: '1px', background: '#f0f0f0', margin: '1.25rem 0' },
  infoRow: { width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  infoLabel: { fontSize: '0.75rem', color: '#888' },
  infoValue: { fontSize: '0.85rem', color: '#1a1a2e', fontWeight: 500 },
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1rem' },
  tab: { padding: '0.6rem 1rem', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '0.85rem', color: '#666', fontWeight: 500 },
  tabActive: { background: '#4f46e5', color: '#fff', border: '1px solid #4f46e5' },
  formCard: { background: '#fff', borderRadius: '12px', padding: '1.75rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  formTitle: { fontSize: '1rem', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.25rem' },
  formSubtitle: { fontSize: '0.85rem', color: '#888', marginBottom: '1.25rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.85rem', color: '#333' },
  input: { width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  submitBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.65rem 1.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, marginTop: '0.5rem' }
}

export default Profile