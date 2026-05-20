import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8025',
        changeOrigin: true,
        secure: false,
      },
      '/ws-chat': {
        target: 'http://localhost:8025',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/province-api': {
        target: 'https://provinces.open-api.vn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/province-api/, ''),
      },
    },
  },
})
