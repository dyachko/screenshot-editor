import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: (import.meta as any).env.DEPLOY_BASE || '/screenshot-editor/',
  plugins: [react()],
}))
