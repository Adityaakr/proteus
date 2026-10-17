import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util'] })],
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
})
