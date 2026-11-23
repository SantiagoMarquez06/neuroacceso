// Se ejecuta antes de cada archivo de pruebas (ver vite.config.ts → test.setupFiles).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
