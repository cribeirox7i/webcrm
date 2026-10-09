import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const commitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'local' }
})()
const _now = new Date()
const _opts = { timeZone: 'America/Sao_Paulo', hour: '2-digit' as const, minute: '2-digit' as const }
const buildDate = `${_now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} - ${_now.toLocaleTimeString('pt-BR', _opts)}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  server: {
    port: 5183,
    strictPort: true,
  },
})
