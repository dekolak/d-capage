import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // On utilise directement les sources TypeScript du kit (même code que l'API).
    alias: { '@decapage/machine-kit': fileURLToPath(new URL('../../packages/machine-kit/src/index.ts', import.meta.url)) },
  },
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
