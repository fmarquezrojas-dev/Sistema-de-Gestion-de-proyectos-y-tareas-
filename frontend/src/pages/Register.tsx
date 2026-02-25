import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../services/api'

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/register', form)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Crear Cuenta</h1>
        <p style={styles.subtitle}>Sistema de Gestión de Proyectos</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Nombre</label>
            <input style={styles.input} name="name" value={form.name} onChange={handleChange} placeholder="Tu nombre" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" name="email" value={form.email} onChange={handleChange} placeholder="tu@email.com" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input style={styles.input} type="password" name="password" value={form.password} onChange={handleChange} placeholder="Mínimo 6 caracteres" required />
          </div>
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Cargando...' : 'Registrarse'}
          </button>
        </form>

        <p style={styles.link}>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' },
  card: { background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1a1a2e' },
  subtitle: { color: '#666', marginBottom: '1.5rem', fontSize: '0.9rem' },
  error: { background: '#fee', color: '#c00', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' },
  field: { marginBottom: '1rem' },
  label: { display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' },
  input: { width: '100%', padding: '0.65rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' },
  button: { width: '100%', padding: '0.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem' },
  link: { textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: '#666' }
}

export default Register