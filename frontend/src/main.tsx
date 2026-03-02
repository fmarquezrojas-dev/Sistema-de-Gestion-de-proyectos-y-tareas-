import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ThemeProvider } from './context/ThemeContext' // 👈 Importamos el cerebro del tema

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider> {/* 👈 Envolvemos TODO con el proveedor de tema */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)