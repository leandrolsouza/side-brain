import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * In development, Vite HMR uses a SharedWorker created via blob: URL.
 * The strict CSP in index.html blocks this. This plugin relaxes the CSP
 * during dev only — production builds keep the restrictive policy.
 */
function devCspPlugin(): Plugin {
  return {
    name: 'dev-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) {
        // Dev mode: relax CSP for Vite HMR (blob: workers + ws: connection)
        return html.replace(
          /content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"/,
          `content="default-src 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5173; worker-src 'self' blob:"`
        )
      }
      return html
    },
  }
}

export default defineConfig({
  plugins: [react(), devCspPlugin()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
