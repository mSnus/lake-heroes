import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from '@svgr/rollup'

export default defineConfig({
  base: './',
  plugins: [react(), svgr()],
  server: {
    port: 3000,
    open: true,
  }
})