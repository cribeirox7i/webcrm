import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AdminApp } from './admin/AdminApp.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import { DefinirSenhaPage } from './auth/DefinirSenhaPage.tsx'
import { MobileOnlyGate } from './components/MobileOnlyGate.tsx'

const path = window.location.pathname

function Root() {
  // Admin e Definir Senha continuam bloqueados no celular por inteiro (leva de 2026-08-12) --
  // só App.tsx (app principal) ganhou layout responsivo, e mesmo lá é por tela, não tudo de
  // uma vez (ver MOBILE_READY_TABS em App.tsx).
  if (path.startsWith('/admin')) return <MobileOnlyGate><AdminApp /></MobileOnlyGate>
  if (path === '/definir-senha') {
    return (
      <MobileOnlyGate>
        <AuthProvider>
          <DefinirSenhaPage />
        </AuthProvider>
      </MobileOnlyGate>
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
