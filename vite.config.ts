import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// vitest 5 + jsdom's undici need Node >= 22.12. On Node 20 every worker dies with
// "Cannot read properties of undefined (reading 'bind')" (forks AND threads), so fail fast with the fix.
const [maj, min] = process.versions.node.split('.').map(Number)
if (process.env.VITEST && (maj < 22 || (maj === 22 && min < 12)))
  throw new Error(`Tests need Node >= 22.12 (running ${process.version}). Use \`nvm use\` (.nvmrc).`)

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: env.VITE_API_PROXY
      ? { proxy: { '/api': { target: env.VITE_API_PROXY, changeOrigin: true } } }
      : undefined,
    test: { environment: 'jsdom', include: ['tests/**/*.test.ts?(x)'] },
  }
})
