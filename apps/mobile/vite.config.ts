import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'url';

// `npm run dev:phone` serves over HTTPS on the LAN: phones only allow GPS, camera,
// microphone and motion sensors on secure pages. /api is proxied to the local API,
// so a phone needs just this one address.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'phone' ? [basicSsl()] : [])],
  resolve: {
    alias: { '@adavya/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5000' },
  },
}));
