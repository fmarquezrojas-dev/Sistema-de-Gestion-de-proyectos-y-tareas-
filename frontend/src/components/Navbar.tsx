/**
 * Navbar.tsx — Componente compartido SYNKRO
 *
 * USO en cualquier página:
 *   import Navbar from '../components/Navbar'
 *   <Navbar />
 *
 * Reemplaza todos los <nav> inline de Dashboard, Projects,
 * ProjectDetail, Tasks y Profile.
 */

import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState'
import { useTheme } from '../context/themeState'

// Ícono de menú hamburguesa (SVG inline)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
    <rect x="2" y="4"  width="16" height="2" rx="1" />
    <rect x="2" y="9"  width="16" height="2" rx="1" />
    <rect x="2" y="14" width="16" height="2" rx="1" />
  </svg>
)

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard',  icon: '📊' },
  { to: '/projects',  label: 'Proyectos',  icon: '📁' },
  { to: '/tasks',     label: 'Mis Tareas', icon: '📋' },
]

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()

  const { isDarkMode, toggleTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname.startsWith(path)

  // ── Avatar: foto si existe, si no inicial + color ──────────────────────────
  const initials = user?.name
    ?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  const avatarColor = user?.avatarColor || '#4f46e5'
  const avatarUrl   = user?.avatarUrl   || null

  return (
    <>
      <nav style={styles.navbar}>

        {/* ── Logo ── */}
        <Link to="/dashboard" style={styles.logo} onClick={() => setMobileOpen(false)}>
          <div style={styles.logoIcon}>S</div>
          <span style={styles.logoText}>SYNKRO</span>
        </Link>

        {/* ── Links centrales (desktop) ── */}
        <div className="nav-center" style={styles.navCenter}>
          {NAV_LINKS.map(link => {
            const active = isActive(link.to)
            return (
              <Link key={link.to} to={link.to} style={{
                ...styles.navLink,
                color:      active ? '#fff' : '#94a3b8',
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderBottom: active ? '2px solid #818cf8' : '2px solid transparent',
              }}>
                <span style={{ fontSize: '0.85rem' }}>{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* ── Derecha: Avatar + Dropdown ── */}
        <div style={styles.navRight}>

          {/* Nombre del usuario (solo desktop) */}
          <span className="nav-username" style={styles.userName}>{user?.name?.split(' ')[0] || ''}</span>

          {/* ── Toggle modo oscuro ── */}
          <button
            onClick={toggleTheme}
            title={isDarkMode ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border:     '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding:    '4px 12px',
              cursor:     'pointer',
              color:      '#e2e8f0',
              display:    'flex',
              alignItems: 'center',
              gap:        '6px',
              fontSize:   '0.78rem',
              fontWeight: 500,
              transition: 'background 0.2s, border-color 0.2s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            {isDarkMode ? '☀️ Día' : '🌙 Noche'}
          </button>

          {/* Avatar con dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={styles.avatarBtn}
              title="Menú de usuario"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Avatar'}
                  style={styles.avatarImg}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div style={{ ...styles.avatarFallback, background: avatarColor }}>
                  {initials}
                </div>
              )}
              {/* Punto de estado online */}
              <div style={styles.onlineDot} />
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={styles.dropdown}>
                {/* Cabecera del dropdown */}
                <div style={styles.dropdownHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" style={{ ...styles.avatarImg, width: '38px', height: '38px' }} />
                    ) : (
                      <div style={{ ...styles.avatarFallback, background: avatarColor, width: '38px', height: '38px', fontSize: '0.9rem' }}>
                        {initials}
                      </div>
                    )}
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
                        {user?.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    background: user?.role === 'ADMIN' ? '#fef3c7' : '#eef2ff',
                    color:      user?.role === 'ADMIN' ? '#b45309'  : '#4f46e5',
                    padding: '0.15rem 0.55rem', borderRadius: '999px',
                    alignSelf: 'flex-start', flexShrink: 0,
                  }}>
                    {user?.role === 'ADMIN' ? '👑 Admin' : '👤 Member'}
                  </span>
                </div>

                <div style={styles.dropdownDivider} />

                {/* Opciones */}
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  style={styles.dropdownItem}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>👤</span> Mi Perfil
                </Link>

                <Link
                  to="/projects"
                  onClick={() => setDropdownOpen(false)}
                  style={styles.dropdownItem}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>📁</span> Mis Proyectos
                </Link>

                <Link
                  to="/tasks"
                  onClick={() => setDropdownOpen(false)}
                  style={styles.dropdownItem}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>📋</span> Mis Tareas
                </Link>

                <div style={styles.dropdownDivider} />

                <button
                  onClick={handleLogout}
                  style={styles.dropdownLogout}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>🚪</span> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="hamburger-btn"
            aria-label="Menú de navegación"
            aria-expanded={mobileOpen}
            style={styles.hamburger}
          >
            <MenuIcon />
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ── */}
      {mobileOpen && (
        <div style={styles.mobileMenu}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              style={{
                ...styles.mobileLink,
                color:      isActive(link.to) ? '#4f46e5' : '#334155',
                fontWeight: isActive(link.to) ? 700 : 500,
              }}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          <div style={{ height: '1px', background: '#e2e8f0', margin: '0.5rem 0' }} />
          <Link to="/profile" onClick={() => setMobileOpen(false)} style={{ ...styles.mobileLink, color: '#334155' }}>
            👤 Mi Perfil
          </Link>
          <button onClick={handleLogout} style={{ ...styles.mobileLink, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', textAlign: 'left', fontFamily: 'inherit' }}>
            🚪 Cerrar sesión
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 1000px) {
          .nav-center { display: none !important; }
          .nav-username { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
        @media (min-width: 1001px) {
          .hamburger-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    background: 'var(--nav-bg)',
    padding: '0 5%',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },

  // Logo
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    textDecoration: 'none', flexShrink: 0,
  },
  logoIcon: {
    width: '30px', height: '30px', borderRadius: '8px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: '1rem',
    letterSpacing: '-0.5px',
  },
  logoText: {
    color: '#fff', fontWeight: 800, fontSize: '1.05rem',
    letterSpacing: '0.1em',
  },

  // Nav center
  navCenter: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
  },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 0.85rem',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '0.88rem', fontWeight: 500,
    transition: 'all 0.15s ease',
    letterSpacing: '0.01em',
  },

  // Right side
  navRight: {
    display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0,
  },
  userName: {
    color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500,
  },
  avatarBtn: {
    position: 'relative', cursor: 'pointer',
    background: 'none', border: 'none', padding: 0,
    borderRadius: '50%',
    width: '36px', height: '36px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: {
    width: '36px', height: '36px', borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(255,255,255,0.15)',
  },
  avatarFallback: {
    width: '36px', height: '36px', borderRadius: '50%',
    color: '#fff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem',
    border: '2px solid rgba(255,255,255,0.15)',
    userSelect: 'none',
  },
  onlineDot: {
    position: 'absolute', bottom: '1px', right: '1px',
    width: '9px', height: '9px', borderRadius: '50%',
    background: '#22c55e', border: '2px solid #0f172a',
  },

  // Dropdown
  dropdown: {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0,
    background: '#fff', borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
    minWidth: '230px', overflow: 'hidden',
    zIndex: 200,
  },
  dropdownHeader: {
    padding: '1rem', background: '#f8fafc',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
  },
  dropdownDivider: {
    height: '1px', background: '#f1f5f9',
  },
  dropdownItem: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.7rem 1rem',
    fontSize: '0.88rem', color: '#374151', textDecoration: 'none',
    transition: 'background 0.1s',
    cursor: 'pointer',
  } as React.CSSProperties,
  dropdownLogout: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.7rem 1rem', width: '100%',
    fontSize: '0.88rem', color: '#ef4444',
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left',
    fontFamily: 'inherit', transition: 'background 0.1s',
  },

  // Mobile
  hamburger: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#94a3b8', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '0.3rem',
  },
  mobileMenu: {
    background: '#fff', padding: '1rem 5%',
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
  },
  mobileLink: {
    padding: '0.65rem 0.75rem',
    borderRadius: '6px', fontSize: '0.9rem',
    display: 'block', textDecoration: 'none',
    color: '#334155', fontWeight: 500,
  },
}

export default Navbar
