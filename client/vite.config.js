import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In dev, proxy the API and Socket.IO so the browser sees ONE origin: no CORS, and the
// httpOnly refresh cookie (Path=/api/auth) just works.
const API = process.env.VITE_DEV_API || 'http://127.0.0.1:4000';

const proxy = {
  '/api': API,
  '/socket.io': { target: API, ws: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  // `npm run build && npm run preview` serves the production bundle with the same proxy.
  preview: { port: 4173, proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
});
