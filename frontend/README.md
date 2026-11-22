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

## Design tokens accesibles

Todos los colores, tamaños y espacios salen de [`src/estilos/tokens.css`](src/estilos/tokens.css) como variables CSS. Ningún componente escribe un color o un tamaño "a mano".

### Reglas que fijan los tokens

| Regla (ver [docs/pantallas.md](../docs/pantallas.md) §1)   | Token                                              |
| ---------------------------------------------------------- | -------------------------------------------------- |
| Todo lo que se pulsa mide **≥ 64 × 64 px**                 | `--objetivo` (64 px) y `--objetivo-grande` (88 px) |
| **≥ 16 px** entre dos objetivos                            | `--separacion`                                     |
| Texto legible a distancia                                  | `--t-base` 20 px … `--t-titular` 58 px             |
| Foco de teclado siempre visible                            | `--foco` + `--ancho-foco` (4 px)                   |
| Barrido: grupo resaltado en azul, elemento activo en ámbar | `--accion` y `--activo`                            |
| El color nunca es la única señal                           | cada estado lleva además texto, icono o forma      |

**Tipografía:** [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), creada por el Braille Institute para personas con baja visión (sus letras no se confunden entre sí: `I l 1`, `O 0`). Va empaquetada con la aplicación, así que funciona **sin internet**.

### Temas y tamaño del texto

Se eligen con atributos en `<html>`; los gestiona [`src/estado/apariencia.ts`](src/estado/apariencia.ts) y se recuerdan en el equipo:

```html
<html data-tema="oscuro" data-texto="normal">
  <!-- por defecto -->
  <html data-tema="contraste" data-texto="grande">
    <!-- alto contraste, texto 20 % más grande -->
  </html>
</html>
```

Si el sistema operativo pide más contraste (`prefers-contrast: more`), la app arranca en alto contraste. Con `prefers-reduced-motion` se desactivan las animaciones.

### Contraste verificado (WCAG AA)

La prueba [`src/estilos/contraste.test.ts`](src/estilos/contraste.test.ts) lee los colores reales de `tokens.css` y comprueba cada par que la interfaz usa junto: **4.5:1** para texto y **3:1** para bordes de controles y el anillo de foco. Si alguien cambia un color y baja del mínimo, `npm test` falla.

Relación de contraste de cada color sobre las tres superficies (`--fondo` · `--superficie` · `--superficie-2`):

| Token           | Uso                               | Tema oscuro        | Alto contraste     |
| --------------- | --------------------------------- | ------------------ | ------------------ |
| `--texto`       | texto principal                   | 15.9 · 12.7 · 10.2 | 21.0 · 21.0 · 17.0 |
| `--texto-suave` | texto secundario                  | 10.8 · 8.7 · 6.9   | 17.6 · 17.6 · 14.3 |
| `--accion`      | botón principal, grupo en barrido | 9.2 · 7.3 · 5.9    | 13.7 · 13.7 · 11.1 |
| `--activo`      | elemento activo en barrido, pausa | 11.2 · 8.9 · 7.2   | 16.5 · 16.5 · 13.4 |
| `--bien`        | conectado, buen contacto          | 10.1 · 8.1 · 6.5   | 16.2 · 16.2 · 13.1 |
| `--mal`         | error, mal contacto               | 7.5 · 6.0 · 4.8    | 8.8 · 8.8 · 7.2    |
| `--apagado`     | desconectado, bloqueado           | 8.1 · 6.5 · 5.2    | 12.6 · 12.6 · 10.2 |
| `--linea`       | borde de controles (mín. 3:1)     | 5.6 · 4.5 · 3.6    | 21.0 · 21.0 · 17.0 |
| `--foco`        | anillo de foco (mín. 3:1)         | 17.2 · 13.8 · 11.0 | 16.5 · 16.5 · 13.4 |

El texto sobre rellenos de color (`--sobre-accion`, `--sobre-activo`, `--sobre-estado`) tiene entre 7.9:1 y 16.5:1.
