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

## Conexión con el motor

La interfaz solo conoce al motor a través del **contrato** ([`contrato/`](../contrato/)):

| Pieza                                               | Qué hace                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`src/api/generado/contrato.ts`](src/api/generado/) | Tipos TypeScript **generados** desde `contrato/openapi.json` y `contrato/ws/*.schema.json`       |
| [`src/api/tipos.ts`](src/api/tipos.ts)              | Nombres cómodos para esos tipos (`Estado`, `Ajustes`, `Evento`…); no define ninguna forma a mano |
| [`src/api/rest.ts`](src/api/rest.ts)                | Cliente REST (`api.perfiles.listar()`, `api.cambiarModo()`…); los fallos llegan como `ErrorApi`  |
| [`src/api/eventos.ts`](src/api/eventos.ts)          | Cliente WebSocket: token, reconexión con espera creciente y manejo de `hola`                     |
| [`src/api/config.ts`](src/api/config.ts)            | Dirección del motor y token (lo lee de `#token=…` en la URL, como lo entrega el motor)           |

### Tipos generados

```bash
npm run tipos            # regenera src/api/generado/contrato.ts desde ../contrato
npm run tipos:verificar  # falla si el archivo no coincide con el contrato (lo usa el CI)
```

Cuando cambie el contrato (por PR aprobado por los dos), basta con `npm run tipos`: TypeScript señala cada lugar de la interfaz que hay que adaptar. El archivo generado **no se edita a mano**.

El generador marca como obligatorios los campos de todo lo que el motor **emite** (respuestas y eventos), porque el motor siempre los serializa completos; lo que la interfaz **envía** conserva sus campos opcionales.

### Cliente WebSocket

```ts
const cliente = new ClienteEventos({ url: () => urlEventos(token) });
cliente.en('gesto', (datos) => console.log(datos.gesto, datos.potencia)); // `datos` va tipado
cliente.enEnlace((enlace) => console.log(enlace.estado)); // conectando · abierto · reconectando…
cliente.conectar();
```

- Al conectar o reconectar llega `hola` con el estado completo: es siempre la fuente de verdad (los eventos perdidos no se reenvían).
- Si la conexión se cae, reintenta sola a los 0.5 s, 1 s, 2 s, 4 s… hasta un máximo de 8 s entre intentos.
- Si el motor rechaza el token deja de reintentar (`no_autorizado`): hay que abrir la interfaz desde el motor.
- Ignora los mensajes mal formados y los tipos de evento que no conoce, como pide el contrato.

Sus pruebas ([`src/api/eventos.nodo.test.ts`](src/api/eventos.nodo.test.ts)) levantan un **servidor WebSocket falso real** en un puerto local, que valida el token y saluda con `hola` igual que el motor.

### Desarrollo contra el motor

```bash
# Terminal 1: motor con casco simulado, aceptando el origen de Vite
cd backend && uv run python -m neuroacceso_motor --demo --dev --sin-raton

# Terminal 2: interfaz
cd frontend && npm run dev
```

El motor imprime su token al arrancar. Abre `http://localhost:5173/#token=EL_TOKEN`. La dirección del motor en desarrollo está en [`.env.development`](.env.development) (`VITE_MOTOR_URL`); en producción la interfaz y la API comparten origen.

## Trabajar sin backend (mocks)

```bash
npm run dev:mock   # http://localhost:5173, sin motor ni casco
```

La interfaz arranca completa contra un **motor simulado en el navegador**. No hace falta Python, ni token, ni casco:

| Pieza                                                  | Qué hace                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`src/mocks/motorFalso.ts`](src/mocks/motorFalso.ts)   | Motor en memoria que sigue el contrato: modos, calibración, perfiles, sesiones, métricas, gestos |
| [`src/mocks/manejadores.ts`](src/mocks/manejadores.ts) | Manejadores [MSW](https://mswjs.io) para cada ruta REST **y para el WebSocket** de eventos       |
| [`src/mocks/navegador.ts`](src/mocks/navegador.ts)     | Arranca el Service Worker de MSW (solo en modo `mock`)                                           |
| [`contrato/ejemplos/`](../contrato/ejemplos/)          | Datos de partida (`salud`, `ajustes`) y eventos usados en las pruebas                            |

- Arranca con dos perfiles (Ana y Pedro), el casco "conectado" y calibrado, y sesiones de ejemplo para el historial.
- El **panel de pruebas** (`/dev`) dispara gestos, mueve la cabeza y simula mal contacto, igual que con el motor en `--demo`.
- Desde la consola del navegador: `motorFalso.fallarConexion('SIN_CASCO', 'No se encontró el casco')` para probar los estados de error.
- Las pruebas de pantallas usan el mismo motor falso sin red ([`src/pruebas/motorDePrueba.ts`](src/pruebas/motorDePrueba.ts)).
- MSW **no llega al build de producción**: ni su código ni `mockServiceWorker.js`.

`npm run capturas` (con `dev:mock` en marcha) guarda una captura de cada pantalla en `docs/img/interfaz/`.

## Prueba de humo contra el motor real

Recorre la interfaz **servida por el motor** (como en el ejecutable) con el casco simulado: perfil, estado, gestos, comunicador, práctica, ajustes, historial y barra flotante. Sirve para los puntos de integración.

```bash
cd frontend && npm run build
cd ../backend && uv run python -m neuroacceso_motor --demo --sin-raton --datos prueba.db
# en otra terminal, con el token que imprime el motor:
cd frontend && npm run humo -- --token EL_TOKEN        # añade --ver para mirar la ventana
```
