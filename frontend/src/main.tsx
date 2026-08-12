import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminApp } from './admin/AdminApp.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { DefinirSenhaPage } from './auth/DefinirSenhaPage.tsx'

const path = window.location.pathname

function Root() {
  if (path.startsWith('/admin')) return <AdminApp />
  if (path === '/definir-senha') {
    return (
      <AuthProvider>
        <DefinirSenhaPage />
      </AuthProvider>
    )
  }
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
