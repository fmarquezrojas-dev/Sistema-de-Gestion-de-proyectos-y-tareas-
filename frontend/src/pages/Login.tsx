import { errorMessage } from '../services/errors'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/authState'

const Login = () => {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { login, message, status, logout }  = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(errorMessage(err, 'No se pudo conectar. Inténtalo más tarde'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      {message && <p role="status" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 10, background: "var(--bg-card)", padding: "1rem" }}>{message}{status === "error" && <button onClick={() => { void logout() }}>Reintentar cierre de sesión</button>}</p>}

      {/* ── Panel izquierdo decorativo ── */}
      <div style={S.left}>
        <div style={S.leftInner}>
          {/* Logo */}
          <div style={S.logo}>
            <div style={S.logoIcon}>S</div>
            <span style={S.logoText}>SYNKRO</span>
          </div>

          <h2 style={S.leftTitle}>Gestiona proyectos y equipos en un solo lugar</h2>
          <p style={S.leftSub}>Organiza tareas, sigue el progreso y colabora con tu equipo de manera eficiente.</p>

          {/* Features */}
          <div style={S.features}>
            {[
              { icon: "📊", title: "Dashboard en tiempo real",  desc: "Visualiza el estado de todos tus proyectos" },
              { icon: "📋", title: "Gestión de tareas",         desc: "Crea, asigna y sigue el progreso de cada tarea" },
              { icon: "👥", title: "Trabajo en equipo",         desc: "Invita miembros y gestiona permisos fácilmente" },
            ].map((f, i) => (
              <div key={i} style={S.feature}>
                <div style={S.featureIcon}>{f.icon}</div>
                <div>
                  <p style={S.featureTitle}>{f.title}</p>
                  <p style={S.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div style={S.right}>
        <div style={S.form}>

          {/* Cabecera */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={S.title}>Bienvenido de vuelta</h1>
            <p style={S.subtitle}>Inicia sesión para acceder a tu espacio de trabajo</p>
          </div>

          {/* Error */}
          {error && (
            <div style={S.errorBox}>
              <span>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#991b1b', flex: 1 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>✉️</span>
                <input
                  style={S.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Contraseña</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>🔒</span>
                <input
                  style={{ ...S.input, paddingRight: '2.5rem' }}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={S.eyeBtn}
                  tabIndex={-1}
                  title={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }} type="submit" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Iniciando sesión...
                </span>
              ) : 'Iniciar sesión →'}
            </button>
          </form>

          <div style={S.divider}>
            <div style={S.dividerLine} />
            <span style={S.dividerText}>¿No tienes cuenta?</span>
            <div style={S.dividerLine} />
          </div>

          <Link to="/register" style={S.registerLink}>
            Crear cuenta gratis
          </Link>

          <p style={S.footer}>
            Al iniciar sesión aceptas los términos de uso de SYNKRO.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', background: '#f0f4f8',
  },

  // Panel izquierdo
  left: {
    flex: '0 0 45%', background: 'linear-gradient(155deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '3rem', position: 'relative', overflow: 'hidden',
  },
  leftInner: { maxWidth: '420px', position: 'relative', zIndex: 1 },
  logo: { display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '2.5rem' },
  logoIcon: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '1.1rem',
  },
  logoText: { color: '#fff', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.12em' },
  leftTitle: { color: '#fff', fontSize: '1.65rem', fontWeight: 800, lineHeight: 1.3, margin: '0 0 0.85rem', letterSpacing: '-0.02em' },
  leftSub:   { color: '#a5b4fc', fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 2.5rem' },
  features: { display: 'flex', flexDirection: 'column', gap: '1.15rem' },
  feature:  { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
  featureIcon: {
    width: '38px', height: '38px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1rem', flexShrink: 0,
  },
  featureTitle: { color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.1rem' },
  featureDesc:  { color: '#94a3b8', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 },

  // Panel derecho
  right: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem',
  },
  form: { width: '100%', maxWidth: '420px' },
  title:    { fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.02em' },
  subtitle: { color: '#64748b', fontSize: '0.9rem', margin: 0 },
  errorBox: {
    display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
    background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
    borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
  },
  field: { marginBottom: '1.25rem' },
  label: { display: 'block', marginBottom: '0.45rem', fontWeight: 600, fontSize: '0.85rem', color: '#374151' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: '0.85rem', fontSize: '0.9rem', pointerEvents: 'none', zIndex: 1 },
  input: {
    width: '100%', padding: '0.75rem 0.85rem 0.75rem 2.5rem',
    border: '1px solid #e2e8f0', borderRadius: '10px',
    fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit',
    background: '#fff', color: '#0f172a', transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  eyeBtn: {
    position: 'absolute', right: '0.75rem',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', opacity: 0.65,
    display: 'flex', alignItems: 'center',
  },
  submitBtn: {
    width: '100%', padding: '0.85rem',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
    marginTop: '0.5rem', letterSpacing: '0.01em',
    boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
    transition: 'opacity 0.15s, transform 0.15s',
  },
  divider: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.75rem 0 1rem' },
  dividerLine: { flex: 1, height: '1px', background: '#e2e8f0' },
  dividerText: { fontSize: '0.82rem', color: '#94a3b8', whiteSpace: 'nowrap' },
  registerLink: {
    display: 'block', textAlign: 'center', padding: '0.8rem',
    border: '1.5px solid #e2e8f0', borderRadius: '10px',
    color: '#4f46e5', fontWeight: 600, fontSize: '0.95rem',
    textDecoration: 'none', transition: 'all 0.15s',
    background: '#fafafa',
  },
  footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' },
}

export default Login
