# API v1 — borrador

> **Estado: v1.0 propuesta para aprobación.** La versión formal y ejecutable está en `openapi.json`, `ws/*.schema.json` y `ejemplos/`, generados desde el código del motor. Este documento la describe en prosa.

## Generalidades
- **Base REST:** `http://127.0.0.1:{puerto}/api/v1`
- **WebSocket:** `ws://127.0.0.1:{puerto}/api/v1/eventos?token={token}`
- **Autenticación:** todas las peticiones REST llevan `Authorization: Bearer {token}`. El token se genera en cada arranque del motor y se inyecta en la ventana (`window.__NA_TOKEN__`). En desarrollo, el motor lo imprime en consola.
- **Formato:** JSON, `snake_case`, fechas ISO 8601 en UTC, tiempos en milisegundos.
- **Errores:** código HTTP adecuado + cuerpo `{ "codigo": "...", "mensaje": "...", "detalle": {...}? }`

| `codigo` | Significado |
|---|---|
| `CORTEX_NO_DISPONIBLE` | El EMOTIV Launcher no está abierto |
| `APP_NO_APROBADA` | Falta aprobar la app en el Launcher |
| `SIN_CASCO` | No se encontró ningún casco |
| `CASCO_DESCONECTADO` | El casco se desconectó |
| `TOKEN_CORTEX_EXPIRADO` | Hay que volver a autorizar |
| `PERFIL_NO_ENCONTRADO` | El perfil no existe |
| `MODO_INVALIDO` | Cambio de modo no permitido en el estado actual |
| `VALIDACION` | El cuerpo de la petición no es válido |
| `NO_AUTORIZADO` | Falta el token o no es válido (HTTP 401; en WebSocket, cierre 1008) |
| `ORIGEN_NO_PERMITIDO` | El `Origin` o el `Host` de la petición no están permitidos (HTTP 403 / 400) |

## REST

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /salud` | – | `{ version, api_version: 1, fuente: "cortex"\|"simulador"\|"replay", demo: bool }` |
| `GET /estado` | – | `Estado` |
| `POST /conexion` | `{ fuente? }` | `202` — el progreso llega por el evento `conexion` |
| `DELETE /conexion` | – | `204` |
| `GET /perfiles` | – | `Perfil[]` |
| `POST /perfiles` | `{ nombre, cortex_profile? }` | `Perfil` |
| `GET /perfiles/{id}` | – | `Perfil` |
| `PATCH /perfiles/{id}` | `{ nombre?, cortex_profile? }` | `Perfil` |
| `DELETE /perfiles/{id}` | – | `204` |
| `POST /perfiles/{id}/activar` | – | `Estado` |
| `GET /perfiles/{id}/ajustes` | – | `Ajustes` |
| `PUT /perfiles/{id}/ajustes` | `Ajustes` (completo) | `Ajustes` — se aplican en caliente |
| `PUT /modo` | `{ modo: "cursor"\|"comunicador"\|"pausa" }` | `{ modo, pausado }` |
| `POST /calibracion` | `{ tipo: "centro" }` | `202` — progreso por el evento `calibracion` |
| `DELETE /calibracion` | – | `204` (cancelar) |
| `GET /gestos/disponibles` | – | `{ facial: { ojos: [], superior: [], inferior: [] }, mental: [] }` |
| `POST /sesiones` | `{ tipo: "libre"\|"practica"\|"comunicador" }` | `Sesion` |
| `POST /sesiones/{id}/finalizar` | – | `Sesion` (con métricas) |
| `GET /sesiones?perfil_id&desde&hasta` | – | `Sesion[]` |
| `GET /sesiones/{id}` | – | `Sesion` |
| `POST /sesiones/{id}/intentos` | `Intento[]` | `204` |
| `POST /sesiones/{id}/enunciados` | `{ texto, duracion_ms, selecciones, correcciones }` | `204` |
| `POST /dev/simular/gesto` *(solo `--demo`)* | `{ gesto, potencia? }` | `204` |
| `POST /dev/simular/cabeza` *(solo `--demo`)* | `{ yaw, pitch }` | `204` |
| `POST /dev/simular/contacto` *(solo `--demo`)* | `{ malo: bool }` | `204` |

## Esquemas

```ts
type Modo = "desconectado" | "calibrando" | "cursor" | "comunicador" | "pausa" | "entrenando";

type Accion = "clic" | "clic_derecho" | "doble_clic" | "pausar" | "seleccionar" | "atras"
            | "cambiar_modo" | "ninguna";

interface Estado {
  conexion: { estado: "desconectado" | "conectando" | "conectado" | "error";
              casco_id?: string; detalle?: string };
  modo: Modo;
  pausado: boolean;
  calibrado: boolean;
  perfil_activo_id?: string;
  latencia_ms: { p50: number; p95: number };
}

interface Perfil { id: string; nombre: string; cortex_profile?: string; creado_en: string }

interface Ajustes {
  version: 1;
  cursor: { ganancia_x: number; ganancia_y: number; zona_muerta: number; suavizado: number;
            invertir_x: boolean; invertir_y: boolean };
  gestos: { umbral: number; cooldown_ms: number;
            mapeo: { cursor: Record<string, Accion>; comunicador: Record<string, Accion> };
            gesto_rescate: string };
  dwell: { activo: boolean; ms: number; radio_px: number };
  comunicador: { tiempo_barrido_ms: number; frases: string[];
                 disposicion: "abc" | "frecuencia" };   // lo guarda el motor, lo usa la interfaz
  voz: { voz_id?: string; velocidad: number };
}

interface Sesion {
  id: string; perfil_id: string; tipo: "libre" | "practica" | "comunicador";
  inicio: string; fin?: string;
  metricas?: { throughput_bps?: number; tiempo_medio_ms?: number; precision?: number;
               falsos_positivos_min?: number; caracteres_min?: number };
}

// Práctica de puntería: lo mide la interfaz; el motor guarda y calcula Fitts.
interface Intento {
  n: number; t_inicio_ms: number; t_fin_ms: number;
  objetivo: { x: number; y: number; ancho: number };   // px CSS
  origen: { x: number; y: number };
  clic: { x: number; y: number };
  acierto: boolean;
  dpr: number;                                          // window.devicePixelRatio
}
```

## Eventos WebSocket (servidor → cliente)

Sobre común:
```json
{ "v": 1, "tipo": "gesto", "seq": 1042, "t": 1763300000123, "datos": { } }
```
- `seq` crece de uno en uno por conexión; `t` es la hora del servidor en ms.
- Las órdenes **no** van por el WebSocket: van por REST.
- Al conectar (o reconectar) llega `hola` con el estado completo; no se reenvían eventos perdidos.

| `tipo` | `datos` | Frecuencia |
|---|---|---|
| `hola` | `{ version, estado: Estado, ajustes: Ajustes \| null }` | al conectar |
| `conexion` | `{ estado, casco_id?, detalle?, codigo? }` | al cambiar |
| `dispositivo` | `{ bateria_pct, senal, contacto: { AF3: 0-4, F7: 0-4, … }, calidad_global: 0-100 }` | 1–2 Hz |
| `orientacion` | `{ yaw, pitch, calibrado }` (grados respecto al centro) | ≤ 20 Hz, descartable |
| `gesto` | `{ gesto, zona: "ojos"\|"superior"\|"inferior"\|"mental", potencia }` | al cambiar (detección cruda, para feedback) |
| `accion` | `{ accion, origen: { tipo: "gesto"\|"mental"\|"dwell"\|"interfaz", nombre }, modo, ejecutada, motivo?: "pausado"\|"cooldown"\|"bajo_umbral" }` | por acción |
| `entrada` | `{ accion: "seleccionar"\|"atras" }` | solo en modo `comunicador` |
| `modo` | `{ modo, pausado, motivo: "usuario"\|"gesto_rescate"\|"ui_desconectada"\|"calibracion" }` | al cambiar |
| `calibracion` | `{ estado: "en_curso"\|"completada"\|"fallida"\|"cancelada", progreso: 0-1, instruccion }` | ~5 Hz mientras dura |
| `ajustes` | `{ perfil_id, ajustes: Ajustes }` | al cambiar |
| `error` | `{ codigo, mensaje, recuperable }` | por error |

## Reservado para v1.1 (entrenamiento · semana 7)
- `POST /entrenamiento` `{ deteccion: "mental"|"facial", accion }` → `{ id }`
- `POST /entrenamiento/{id}/aceptar` · `POST /entrenamiento/{id}/rechazar`
- Evento `entrenamiento` `{ fase: "iniciado"|"exito"|"fallo"|"guardado", accion }` (traducido de los eventos `sys` de Cortex).
