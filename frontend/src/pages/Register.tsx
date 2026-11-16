import { errorMessage } from '../services/errors'
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [passStrength, setPassStrength] = useState(0) // 0-3
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  const evaluateStrength = (pw: string): number => {
    let score = 0
    if (pw.length >= 8)  score++
    if (pw.length >= 10) score++
    if (/[A-Z]/.test(pw) || /\d/.test(pw)) score++
    return score
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
    if (name === 'password') setPassStrength(evaluateStrength(value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err) {
      setError(errorMessage(err, 'Error al crear la cuenta. Intenta nuevamente.'))
    } finally {
      setLoading(false)
    }
  }

  const strengthLabel = ['', 'Débil', 'Aceptable', 'Fuerte']
  const strengthColor = ['#e2e8f0', '#ef4444', '#f59e0b', '#22c55e']

  return (
    <div style={S.page}>

      {/* ── Panel derecho — formulario (primero en mobile) ── */}
      <div style={S.right}>
        <div style={S.form}>

          {/* Logo mobile / small */}
          <div style={{ ...S.logo, marginBottom: '1.75rem' }}>
            <div style={S.logoIcon}>S</div>
            <span style={S.logoText}>SYNKRO</span>
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <h1 style={S.title}>Crea tu cuenta</h1>
            <p style={S.subtitle}>Empieza a organizar tus proyectos hoy mismo — es gratis</p>
          </div>

          {error && (
            <div style={S.errorBox}>
              <span>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#991b1b', flex: 1 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={S.field}>
              <label style={S.label}>Nombre completo</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>👤</span>
                <input
                  style={S.input}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Tu nombre completo"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Email</label>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>✉️</span>
                <input
                  style={S.input}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div style={S.field}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                <label style={S.label}>Contraseña</label>
                {form.password && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: strengthColor[passStrength] }}>
                    {strengthLabel[passStrength]}
                  </span>
                )}
              </div>
              <div style={S.inputWrap}>
                <span style={S.inputIcon}>🔒</span>
                <input
                  style={{ ...S.input, paddingRight: '2.5rem' }}
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={S.eyeBtn} tabIndex={-1}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>

              {/* Barra de fortaleza */}
              {form.password && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '4px', borderRadius: '999px',
                      background: i <= passStrength ? strengthColor[passStrength] : '#e2e8f0',
                      transition: 'background 0.3s ease',
                    }} />
                  ))}
                </div>
              )}
            </div>

            <button style={{ ...S.submitBtn, opacity: loading ? 0.75 : 1 }} type="submit" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Creando cuenta...
                </span>
              ) : 'Crear cuenta gratis →'}
            </button>
          </form>

          <div style={S.divider}>
            <div style={S.dividerLine} />
            <span style={S.dividerText}>¿Ya tienes cuenta?</span>
            <div style={S.dividerLine} />
          </div>

          <Link to="/login" style={S.loginLink}>Iniciar sesión</Link>

          <p style={S.footer}>
            Al crear una cuenta aceptas los términos de uso de SYNKRO.
          </p>
        </div>
      </div>

      {/* ── Panel izquierdo decorativo ── */}
      <div style={S.left}>
        <div style={S.leftInner}>
          <div style={{ ...S.logo, marginBottom: '2.5rem' }}>
            <div style={S.logoIcon}>S</div>
            <span style={S.logoText}>SYNKRO</span>
          </div>
          <h2 style={S.leftTitle}>Todo tu equipo, en sincronía</h2>
          <p style={S.leftSub}>
            Desde la creación de proyectos hasta la entrega final — SYNKRO te da las herramientas para trabajar sin fricciones.
          </p>

          {/* Stats decorativas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2.5rem' }}>
            {[
              { value: '∞',   label: 'Proyectos ilimitados' },
              { value: '👥',  label: 'Equipos colaborativos' },
              { value: '📊',  label: 'Dashboard en tiempo real' },
              { value: '🔐',  label: 'Control de permisos' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: '0.3rem',
              }}>
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{stat.value}</span>
                <span style={{ fontSize: '0.78rem', color: '#a5b4fc', lineHeight: 1.4 }}>{stat.label}</span>
              </div>
            ))}
          </div>
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
  page: { minHeight: '100vh', display: 'flex', background: '#f0f4f8' },

  right: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem', order: 1,
  },
  form: { width: '100%', maxWidth: '420px' },
  logo: { display: 'flex', alignItems: 'center', gap: '0.65rem' },
  logoIcon: {
    width: '34px', height: '34px', borderRadius: '9px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: '1rem',
  },
  logoText: { color: '#0f172a', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.1em' },
  title:    { fontSize: '1.7rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem', letterSpacing: '-0.02em' },
  subtitle: { color: '#64748b', fontSize: '0.9rem', margin: 0 },
  errorBox: {
    display: 'flex', gap: '0.65rem', alignItems: 'flex-start',
    background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
    borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1.25rem',
  },
  field: { marginBottom: '1.25rem' },
  label: { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', margin: 0 },
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
  },
  submitBtn: {
    width: '100%', padding: '0.85rem',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.5rem',
    letterSpacing: '0.01em', boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
  },
  divider: { display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.75rem 0 1rem' },
  dividerLine: { flex: 1, height: '1px', background: '#e2e8f0' },
  dividerText: { fontSize: '0.82rem', color: '#94a3b8', whiteSpace: 'nowrap' },
  loginLink: {
    display: 'block', textAlign: 'center', padding: '0.8rem',
    border: '1.5px solid #e2e8f0', borderRadius: '10px',
    color: '#4f46e5', fontWeight: 600, fontSize: '0.95rem',
    textDecoration: 'none', background: '#fafafa',
  },
  footer: { textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: '#94a3b8' },

  // Panel izquierdo
  left: {
    flex: '0 0 42%', order: 2,
    background: 'linear-gradient(155deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem',
  },
  leftInner: { maxWidth: '400px' },
  leftTitle: { color: '#fff', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.3, margin: '0 0 0.85rem', letterSpacing: '-0.02em' },
  leftSub:   { color: '#a5b4fc', fontSize: '0.93rem', lineHeight: 1.65, margin: 0 },
}

export default Register
