import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

// Settings come from the repository's single .env (and .env.production for builds).
const envDir = fileURLToPath(new URL('../..', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    plugins: [react()],
    envDir,
    resolve: {
      alias: { '@adavya/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
    },
    server: {
      port: 5173,
      host: true,
      proxy: { '/api': env.API_PROXY_TARGET || `http://localhost:${env.PORT || 5000}` },
    },
  };
});
