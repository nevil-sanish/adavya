import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'url';

// Settings come from the repository's single .env (and .env.production for builds).
const envDir = fileURLToPath(new URL('../..', import.meta.url));

// `npm run dev:phone` serves over HTTPS on the LAN: phones only allow GPS, camera,
// microphone and motion sensors on secure pages. /api is proxied to the local API,
// so a phone needs just this one address.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  return {
    plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
    envDir,
    resolve: {
      alias: { '@adavya/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      proxy: { '/api': env.API_PROXY_TARGET || `http://localhost:${env.PORT || 5000}` },
    },
  };
});
