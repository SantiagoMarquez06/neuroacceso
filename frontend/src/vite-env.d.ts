/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del motor en desarrollo (p. ej. http://127.0.0.1:8765). Vacío = mismo origen. */
  readonly VITE_MOTOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
