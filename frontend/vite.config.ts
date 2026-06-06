import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';
  const proxyOrigin = env.VITE_PROXY_ORIGIN?.trim();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              // Local QA often runs the frontend on an alternate port while the
              // API is Railway-hosted. The browser Origin is then a local dev
              // URL that production CORS correctly rejects. When a QA backend
              // requires an allowed origin, forward the configured proxy origin;
              // otherwise keep stripping the browser origin to avoid weakening
              // production CORS while preserving local browser QA.
              if (proxyOrigin) {
                proxyReq.setHeader('origin', proxyOrigin);
                return;
              }

              proxyReq.removeHeader('origin');
            });
          },
        },
      },
    },
  };
});
