# Interfaz de NeuroAcceso (frontend) — Parte B

Lo que **ve y usa la persona**: una aplicación React + TypeScript + Vite que habla con el motor (`backend/`) por la API v1. A cargo de **Jonnathan** ([@jonnathanguaman](https://github.com/jonnathanguaman)).

- Qué pantallas hay y cómo se usan: [docs/pantallas.md](../docs/pantallas.md)
- Datos y eventos del motor: [contrato/](../contrato/)
- Arquitectura: [docs/arquitectura-sistema.md](../docs/arquitectura-sistema.md)
- Tareas: issues con la etiqueta `parte-B-interfaz`

## Requisitos

- Node.js 22.12 o superior (se desarrolla con Node 24) y npm.

## Uso

```bash
cd frontend
npm install

npm run dev        # interfaz en http://localhost:5173 (necesita el motor, ver abajo)
npm run build      # compila a frontend/dist (lo sirve el motor)
npm test           # pruebas (Vitest + Testing Library)
npm run lint       # ESLint (incluye reglas de accesibilidad)
npm run typecheck  # TypeScript estricto
npm run format     # Prettier
```

| Comando              | Para qué                                               |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Servidor de desarrollo de Vite en el puerto 5173       |
| `npm run build`      | Comprueba los tipos y genera `dist/`                   |
| `npm run preview`    | Sirve `dist/` para revisarlo                           |
| `npm test`           | Ejecuta todas las pruebas una vez                      |
| `npm run test:watch` | Pruebas en modo observador                             |
| `npm run lint`       | Análisis estático                                      |
| `npm run typecheck`  | Solo comprobación de tipos                             |
| `npm run format`     | Da formato al código (`format:check` solo lo verifica) |
