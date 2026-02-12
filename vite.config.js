import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dialog: resolve(__dirname, 'dialog.html')
      },
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 8766,
    host: true
  }
})
