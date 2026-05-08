import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import { defineConfig as defineVitestConfig } from 'vitest/config';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

/** Local Netlify Functions server (see npm run dev). */
const FUNCTIONS_PROXY_TARGET =
  process.env.VITE_FUNCTIONS_PROXY_TARGET ?? 'http://127.0.0.1:9999';

const coopHeaders = {
  // Firebase Auth popup checks opener/window.closed; strict COOP breaks that.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
  },
  build: {
    outDir: 'dist',
  },
  server: {
    headers: coopHeaders,
    proxy: {
      '/.netlify/functions': {
        target: FUNCTIONS_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: coopHeaders,
    proxy: {
      '/.netlify/functions': {
        target: FUNCTIONS_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
