/**
 * Profile.tsx
 *
 * FIXES:
 *  1. Bug avatar en carga inicial: se hace un GET /auth/me al montar para
 *     obtener avatarColor y avatarUrl actualizados (sin depender solo del token).
 *  2. Foto de perfil: el usuario puede subir una imagen que se convierte a
 *     base64 y se envía junto con el resto de datos del perfil.
 *
 * BACKEND necesario:
 *  - Agregar `avatarUrl String?` al modelo User en schema.prisma
 *  - Correr `npx prisma migrate dev`
 *  - El endpoint PUT /auth/profile debe aceptar y guardar `avatarUrl`
 *  - El endpoint GET /auth/me (o el que uses para obtener el usuario actual)
 *    debe devolver `avatarUrl` y `avatarColor`
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import api from '../services/api'

const AVATAR_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#d97706', '#16a34a', '#0891b2',
]

// Tamaño máximo: 2MB
const MAX_FILE_SIZE_MB = 2

const Profile = () => {
  const { user, updateUser } = useAuth()
  const navigate             = useNavigate()

  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'danger'>('info')

  // ── Estado del formulario de información ─────────────────────────────────
  const [infoForm, setInfoForm] = useState({ name: '', email: '' })
  const [savingInfo, setSavingInfo] = useState(false)

  // ── Avatar: color + foto ──────────────────────────────────────────────────
  const [avatarColor, setAvatarColor] = useState('#4f46e5')
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null)  // URL guardada en DB
  const [photoPreview, setPhotoPreview] = useState<string | null>(null) // base64 local (preview)
  const [photoBase64,  setPhotoBase64]  = useState<string | null>(null) // base64 para enviar
  //const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Contraseña ────────────────────────────────────────────────────────────
  const [passForm, setPassForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  })
  const [savingPass, setSavingPass] = useState(false)
  const [passMatch, setPassMatch]   = useState<null | boolean>(null)

  // ── Danger zone ───────────────────────────────────────────────────────────
  const [deletePassword,    setDeletePassword]    = useState('')
  const [deleting,          setDeleting]          = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<{ totalProjects: number; pendingTasks: number } | null>(null)

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── ✅ FIX: Fetch del perfil real al montar ───────────────────────────────
  // El token/localStorage puede NO incluir avatarColor ni avatarUrl.
  // Hacemos un GET al montar para obtener los datos actualizados del servidor.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Ajusta la ruta a la que uses para obtener el usuario autenticado
        const res = await api.get('/auth/me') // o /auth/profile
        const u   = res.data?.data ?? res.data
        if (u) {
          setInfoForm({ name: u.name || '', email: u.email || '' })
          setAvatarColor(u.avatarColor || '#4f46e5')
          setAvatarUrl(u.avatarUrl || null)
          // Actualiza el contexto para que el Navbar también se actualice
          updateUser({ avatarColor: u.avatarColor, avatarUrl: u.avatarUrl })
        }
      } catch {
        // Si falla el fetch, caemos de vuelta al user del contexto
        setInfoForm({ name: user?.name || '', email: user?.email || '' })
        setAvatarColor(user?.avatarColor || '#4f46e5')
        setAvatarUrl((user as any)?.avatarUrl || null)
      }
    }

    fetchProfile()
    api.get('/auth/profile/stats').then(res => setStats(res.data.data)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Manejo de foto ────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      showToast('Solo se permiten archivos de imagen (JPG, PNG, WebP)', 'error')
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`La imagen no puede superar ${MAX_FILE_SIZE_MB}MB`, 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setPhotoPreview(base64)
      setPhotoBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setPhotoPreview(null)
    setPhotoBase64(null)
    setAvatarUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Guardar información (incluyendo foto y color) ─────────────────────────
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingInfo(true)
    try {
      const payload: any = {
        name:        infoForm.name,
        email:       infoForm.email,
        avatarColor: avatarColor,
      }
      // Si hay nueva foto en base64, la incluimos
      if (photoBase64) {
        payload.avatarUrl = photoBase64
      } else if (avatarUrl === null && !photoBase64) {
        // El usuario eliminó la foto
        payload.avatarUrl = null
      }

      const res = await api.put('/auth/profile', payload)
      const updated = res.data?.data ?? res.data

      // Actualizar estado local
      setAvatarColor(updated.avatarColor || avatarColor)
      setAvatarUrl(updated.avatarUrl || null)
      setPhotoPreview(null)
      setPhotoBase64(null)

      // Actualizar contexto global (Navbar se actualiza automáticamente)
      updateUser({
        name:        updated.name,
        email:       updated.email,
        avatarColor: updated.avatarColor,
        avatarUrl:   updated.avatarUrl,
      })

      showToast('Perfil actualizado correctamente.')
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al actualizar perfil', 'error')
    } finally {
      setSavingInfo(false)
    }
  }

  // ── Cambiar contraseña ────────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passForm.newPassword !== passForm.confirmPassword) {
      showToast('Las contraseñas no coinciden.', 'error'); return
    }
    if (passForm.newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres.', 'error'); return
    }
    setSavingPass(true)
    try {
      await api.put('/auth/password', {
        currentPassword: passForm.currentPassword,
        newPassword:     passForm.newPassword,
      })
      showToast('Contraseña actualizada correctamente.')
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPassMatch(null)
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al cambiar contraseña', 'error')
    } finally {
      setSavingPass(false)
    }
  }

  // ── Eliminar cuenta ───────────────────────────────────────────────────────
  const { logout } = useAuth()
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleting(true)
    try {
      await api.delete('/auth/account', { data: { password: deletePassword } })
      await logout()
      navigate('/login')
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Error al eliminar cuenta', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── Avatar display: preview > avatarUrl > color+iniciales ─────────────────
  const displayPhoto = photoPreview || avatarUrl
  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 1001,
          background: toast.type === 'success' ? '#f0fdf4' : toast.type === 'warning' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${toast.type === 'success' ? '#22c55e' : toast.type === 'warning' ? '#f59e0b' : '#ef4444'}`,
          borderLeft: `4px solid ${toast.type === 'success' ? '#22c55e' : toast.type === 'warning' ? '#f59e0b' : '#ef4444'}`,
          borderRadius: '8px', padding: '1rem 1.25rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '280px',
        }}>
          <span>{toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}</span>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500, flex: 1,
            color: toast.type === 'success' ? '#15803d' : toast.type === 'warning' ? '#92400e' : '#dc2626' }}>
            {toast.message}
          </p>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>✕</button>
        </div>
      )}

      {/* ── Navbar compartido ── */}
      <Navbar />

      <div style={styles.content}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={styles.pageTitle}>Mi Perfil</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
            Gestiona tu información personal, foto y configuración de cuenta
          </p>
        </div>

        <div style={styles.grid}>

          {/* ──────────── Panel izquierdo ──────────── */}
          <div style={styles.avatarCard}>

            {/* ── Foto/Avatar principal ── */}
            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt={user?.name || 'Avatar'}
                  style={styles.avatarImgLarge}
                  onError={() => { setPhotoPreview(null); setAvatarUrl(null) }}
                />
              ) : (
                <div style={{ ...styles.avatarCircle, background: avatarColor }}>
                  {initials}
                </div>
              )}

              {/* Botón de edición flotante */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={styles.editPhotoBtn}
                title="Cambiar foto"
              >
                📷
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <h2 style={styles.avatarName}>{user?.name || infoForm.name}</h2>
            <p style={styles.avatarEmail}>{user?.email || infoForm.email}</p>
            <span style={styles.roleBadge}>
              {user?.role === 'ADMIN' ? '👑 Admin' : '👤 Member'}
            </span>

            {/* Acciones de foto */}
            {(displayPhoto || photoPreview) && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: '0.75rem', background: '#eef2ff', color: '#4f46e5', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cambiar
                </button>
                <button
                  onClick={handleRemovePhoto}
                  style={{ fontSize: '0.75rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Quitar foto
                </button>
              </div>
            )}

            {!displayPhoto && (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ marginTop: '0.75rem', fontSize: '0.78rem', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                📷 Subir foto
              </button>
            )}

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.4rem 0 0', textAlign: 'center' }}>
              JPG, PNG o WebP · Máx. {MAX_FILE_SIZE_MB}MB
            </p>

            <div style={styles.divider} />

            {/* Stats */}
            <div style={styles.statsGrid}>
              <button onClick={() => navigate('/projects')} style={styles.statBtn}>
                <span style={styles.statValue}>{stats?.totalProjects ?? '—'}</span>
                <span style={styles.statLabel}>Proyectos</span>
              </button>
              <button onClick={() => navigate('/tasks')} style={styles.statBtn}>
                <span style={{ ...styles.statValue, color: '#f59e0b' }}>{stats?.pendingTasks ?? '—'}</span>
                <span style={styles.statLabel}>Pendientes</span>
              </button>
            </div>

            <div style={styles.divider} />

            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Miembro desde</span>
              <span style={styles.infoValue}>
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long' })
                  : '—'}
              </span>
            </div>

            <div style={styles.divider} />

            {/* Selector de color de avatar */}
            <div style={{ width: '100%' }}>
              <p style={{ ...styles.infoLabel, marginBottom: '0.6rem', textAlign: 'center' }}>
                Color de avatar
              </p>
              {displayPhoto && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.5rem' }}>
                  Se usará si no tienes foto
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    title={color}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: color, border: 'none', cursor: 'pointer',
                      boxShadow: avatarColor === color ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : 'none',
                      transform: avatarColor === color ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {avatarColor === color && (
                      <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ──────────── Panel derecho ──────────── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.tabs}>
              <button style={{ ...styles.tab, ...(activeTab === 'info'     ? styles.tabActive : {}) }} onClick={() => setActiveTab('info')}>
                ✏️ Información
              </button>
              <button style={{ ...styles.tab, ...(activeTab === 'password' ? styles.tabActive : {}) }} onClick={() => setActiveTab('password')}>
                🔒 Contraseña
              </button>
              <button style={{ ...styles.tab, ...(activeTab === 'danger'   ? styles.tabDanger : {}) }} onClick={() => setActiveTab('danger')}>
                ⚠️ Zona de peligro
              </button>
            </div>

            {/* ── Tab: Información ── */}
            {activeTab === 'info' && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Información personal</h3>
                <p style={styles.formSubtitle}>
                  Actualiza tu nombre, email, foto y color de avatar. Todos los cambios se guardan juntos.
                </p>

                <form onSubmit={handleSaveInfo}>
                  <div style={styles.field}>
                    <label style={styles.label}>Nombre completo</label>
                    <input
                      style={styles.input}
                      value={infoForm.name}
                      onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
                      placeholder="Tu nombre completo"
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

                  {/* Preview de foto pendiente */}
                  {photoBase64 && (
                    <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img src={photoBase64} alt="preview" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #22c55e' }} />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.83rem', fontWeight: 600, color: '#15803d' }}>
                          📷 Nueva foto lista para guardar
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                          Se subirá al hacer clic en "Guardar cambios"
                        </p>
                      </div>
                      <button type="button" onClick={handleRemovePhoto} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem' }}>✕</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button style={styles.submitBtn} type="submit" disabled={savingInfo}>
                      {savingInfo ? '⏳ Guardando...' : '💾 Guardar cambios'}
                    </button>
                    {photoBase64 && (
                      <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>
                        ✓ Foto lista para subir
                      </span>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* ── Tab: Contraseña ── */}
            {activeTab === 'password' && (
              <div style={styles.formCard}>
                <h3 style={styles.formTitle}>Cambiar contraseña</h3>
                <p style={styles.formSubtitle}>Usa una contraseña segura de al menos 6 caracteres.</p>
                <form onSubmit={handleChangePassword}>
                  <div style={styles.field}>
                    <label style={styles.label}>Contraseña actual</label>
                    <input style={styles.input} type="password"
                      value={passForm.currentPassword}
                      onChange={e => setPassForm({ ...passForm, currentPassword: e.target.value })}
                      placeholder="••••••" required />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nueva contraseña</label>
                    <input style={styles.input} type="password"
                      value={passForm.newPassword}
                      onChange={e => {
                        const val = e.target.value
                        setPassForm({ ...passForm, newPassword: val })
                        if (passForm.confirmPassword) setPassMatch(val === passForm.confirmPassword)
                      }}
                      placeholder="••••••" required />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Confirmar nueva contraseña</label>
                    <input
                      style={{ ...styles.input, borderColor: passMatch === null ? '#e2e8f0' : passMatch ? '#22c55e' : '#ef4444' }}
                      type="password"
                      value={passForm.confirmPassword}
                      onChange={e => {
                        const val = e.target.value
                        setPassForm({ ...passForm, confirmPassword: val })
                        setPassMatch(passForm.newPassword === val)
                      }}
                      placeholder="••••••" required />
                    {passMatch === false && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.3rem' }}>❌ Las contraseñas no coinciden</p>}
                    {passMatch === true  && <p style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: '0.3rem' }}>✅ Las contraseñas coinciden</p>}
                  </div>
                  <button style={{ ...styles.submitBtn, opacity: passMatch === false ? 0.6 : 1 }} type="submit" disabled={savingPass || passMatch === false}>
                    {savingPass ? '⏳ Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Tab: Zona de peligro ── */}
            {activeTab === 'danger' && (
              <div style={{ ...styles.formCard, border: '1px solid #fecaca' }}>
                <h3 style={{ ...styles.formTitle, color: '#dc2626' }}>⚠️ Zona de peligro</h3>
                <p style={styles.formSubtitle}>Estas acciones son irreversibles. Procede con mucho cuidado.</p>
                <div style={styles.dangerBox}>
                  <div>
                    <p style={styles.dangerTitle}>Eliminar mi cuenta</p>
                    <p style={styles.dangerDesc}>
                      Se eliminarán todos tus datos, proyectos y tareas de forma permanente.
                    </p>
                  </div>
                  <button onClick={() => setShowDeleteConfirm(!showDeleteConfirm)} style={styles.dangerBtn}>
                    {showDeleteConfirm ? 'Cancelar' : 'Eliminar cuenta'}
                  </button>
                </div>
                {showDeleteConfirm && (
                  <form onSubmit={handleDeleteAccount} style={styles.dangerForm}>
                    <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 500, marginBottom: '0.75rem' }}>
                      Confirma tu contraseña para continuar:
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <input
                        style={{ ...styles.input, borderColor: '#fecaca' }}
                        type="password"
                        placeholder="Tu contraseña actual"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        required
                      />
                      <button type="submit" disabled={deleting} style={styles.dangerSubmitBtn}>
                        {deleting ? '...' : 'Confirmar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: 'var(--bg-app)' },
  content: { padding: '2rem 5%', maxWidth: '1440px', margin: '0 auto', boxSizing: 'border-box' },
  pageTitle: { fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' },
  grid: { display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' },

  // Panel izquierdo
  avatarCard: {
    background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem',
    boxShadow: 'var(--shadow-card)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: '280px', flexShrink: 0,
    border: '1px solid var(--border-color)',
  },
  avatarCircle: {
    width: '100px', height: '100px', borderRadius: '50%',
    color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '2.2rem', fontWeight: 800,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  avatarImgLarge: {
    width: '100px', height: '100px', borderRadius: '50%',
    objectFit: 'cover', border: '3px solid #e2e8f0',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'block',
  },
  editPhotoBtn: {
    position: 'absolute', bottom: '2px', right: '2px',
    width: '30px', height: '30px', borderRadius: '50%',
    background: 'var(--text-primary)', color: 'var(--bg-card)',
    border: '2px solid #fff', cursor: 'pointer',
    fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarName:  { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem', textAlign: 'center' },
  avatarEmail: { fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem', textAlign: 'center', wordBreak: 'break-all' },
  roleBadge:   { fontSize: '0.75rem', background: '#eef2ff', color: '#4f46e5', padding: '0.35rem 0.85rem', borderRadius: '999px', fontWeight: 700 },
  divider:     { width: '100%', height: '1px', background: 'var(--border-light)', margin: '1.25rem 0' },
  statsGrid:   { display: 'flex', gap: '0.75rem', width: '100%' },
  statBtn:     { flex: 1, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.85rem 0.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' },
  statValue:   { fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5' },
  statLabel:   { fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' },
  infoRow:     { width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' },
  infoLabel:   { fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 },
  infoValue:   { fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 },

  // Panel derecho
  tabs: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'var(--border-color)', padding: '0.4rem', borderRadius: '10px', width: 'fit-content' },
  tab: { padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 },
  tabActive: { background: 'var(--bg-card)', color: '#4f46e5', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  tabDanger: { color: '#ef4444' },
  formCard:  { background: 'var(--bg-card)', borderRadius: '16px', padding: '2rem', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-color)' },
  formTitle: { fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' },
  formSubtitle: { fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' },
  field:  { marginBottom: '1.25rem' },
  label:  { display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' },
  input:  { width: '100%', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  submitBtn: { background: '#4f46e5', color: '#fff', border: 'none', padding: '0.8rem 2rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 },
  dangerBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff1f1', padding: '1.25rem', borderRadius: '10px', gap: '1.5rem', border: '1px solid #fee2e2' },
  dangerTitle: { fontWeight: 700, fontSize: '0.95rem', color: '#dc2626', margin: '0 0 0.25rem' },
  dangerDesc:  { fontSize: '0.85rem', color: '#7f1d1d', margin: 0, opacity: 0.8 },
  dangerBtn:   { background: '#dc2626', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' },
  dangerForm:  { marginTop: '1.5rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '12px', border: '2px dashed #fecaca' },
  dangerSubmitBtn: { background: '#dc2626', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
}

export default Profile
