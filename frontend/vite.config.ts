/// <reference types="vitest/config" />
import { rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

/**
 * public/mockServiceWorker.js solo hace falta para `npm run dev:mock` (MSW). En el build normal
 * se quita de dist/: el motor no debe servir un Service Worker que nadie usa.
 */
function sinTrabajadorDeMocks(modo: string): Plugin {
  return {
    name: 'sin-trabajador-de-mocks',
    apply: 'build',
    closeBundle() {
      if (modo !== 'mock') rmSync(ruta('./dist/mockServiceWorker.js'), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), sinTrabajadorDeMocks(mode)],
  resolve: {
    alias: {
      '@': ruta('./src'),
      '@contrato': ruta('../contrato'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // el motor solo acepta este origen con --dev
    fs: { allow: ['..'] }, // los mocks leen ../contrato/ejemplos
  },
  build: {
    outDir: 'dist', // el motor sirve frontend/dist
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/pruebas/preparar.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    css: true, // la prueba de contraste lee los colores reales de tokens.css
  },
}));
