import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT || 5173)

  return {
    plugins: [react()],
    server: {
      port,
      host: true,
    },
    preview: {
      port,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined
            }

            if (id.includes('@tanstack/react-query')) {
              return 'query'
            }

            if (id.includes('zustand')) {
              return 'state'
            }

            if (id.includes('@lottiefiles/dotlottie-react') || id.includes('@dotlottie/react-player') || id.includes('lottie-react')) {
              return 'lottie'
            }

            if (id.includes('lucide-react')) {
              return 'icons'
            }

            if (id.includes('react-dom') || id.includes('react/')) {
              return 'react-vendor'
            }

            if (id.includes('node_modules')) {
              return 'vendor'
            }

            return undefined
          },
        },
      },
    },
  }
})
