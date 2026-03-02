import { createContext, useContext, useEffect, useState } from 'react'

interface ThemeContextType {
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  toggleTheme: () => {},
})

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Al cargar: respeta preferencia guardada, si no hay ninguna usa preferencia del sistema
    const saved = localStorage.getItem('synkro-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = window.document.documentElement
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark')
      localStorage.setItem('synkro-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
      localStorage.setItem('synkro-theme', 'light')
    }
  }, [isDarkMode])

  const toggleTheme = () => setIsDarkMode(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
