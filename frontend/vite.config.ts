import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  
  // ADD THIS SERVER BLOCK
  server: {
    host: true, // Listen on all local IPs (equivalent to --host)
    port: 5173,
    watch: {
      usePolling: true, // Highly recommended for Docker to detect file changes reliably
    },
    hmr: {
      clientPort: 5173, // Force the HMR client to connect to port 5173
      host: 'localhost' // Force the HMR client to connect to localhost
    }
  }
})