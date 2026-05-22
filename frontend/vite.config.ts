import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:5000';

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
              // URL that production CORS correctly rejects. The dev proxy is
              // same-origin from the browser perspective, so remove Origin
              // before forwarding to keep local browser QA usable without
              // weakening production CORS.
              proxyReq.removeHeader('origin');
            });
          },
        },
      },
    },
  };
});
