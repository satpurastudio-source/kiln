import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative asset paths — works at any URL depth (GitHub Pages subpath,
  // local file previews, and later inside the Tauri app shell)
  base: './',
})
