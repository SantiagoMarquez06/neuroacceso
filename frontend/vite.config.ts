/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

export default defineConfig({
  plugins: [react()],
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
    css: false,
  },
});
