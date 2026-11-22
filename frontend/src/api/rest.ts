// Cliente REST de la API v1: órdenes y consultas al motor (ver contrato/api-v1.md).
// Los eventos en tiempo real llegan por el WebSocket (eventos.ts), no por aquí.
import { obtenerToken, urlRest } from './config';
import type {
  Ajustes,
  CodigoError,
  CuerpoError,
  Deteccion,
  EntrenamientoIniciado,
  Enunciado,
  Estado,
  GestosDisponibles,
  Intento,
  ModoActual,
  ModoPedible,
  Perfil,
  PerfilCrear,
  PerfilEditar,
  Salud,
  Sesion,
  TipoSesion,
} from './tipos';

/** Códigos del contrato más los que detecta la propia interfaz. */
export type CodigoApi = CodigoError | 'MOTOR_NO_DISPONIBLE' | 'DESCONOCIDO';

/** Error de una petición al motor. `codigo` es estable: los textos para la persona salen de él. */
export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoApi,
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function responder(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<Response> {
  const cabeceras: Record<string, string> = {};
  const token = obtenerToken();
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

  let respuesta: Response;
  try {
    respuesta = await fetch(urlRest(ruta), {
      method: metodo,
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'MOTOR_NO_DISPONIBLE', 'No se puede conectar con NeuroAcceso');
  }
  if (respuesta.ok) return respuesta;

  const error = (await respuesta.json().catch(() => null)) as Partial<CuerpoError> | null;
  throw new ErrorApi(
    respuesta.status,
    error?.codigo ?? 'DESCONOCIDO',
    error?.mensaje ?? `El motor respondió ${respuesta.status}`,
    error?.detalle ?? undefined,
  );
}

/** Petición que devuelve JSON. */
async function pedir<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
  const respuesta = await responder(metodo, ruta, cuerpo);
  return (await respuesta.json()) as T;
}

/** Petición sin cuerpo de respuesta (202 / 204). */
async function ordenar(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<void> {
  await responder(metodo, ruta, cuerpo);
}

const id = encodeURIComponent;

function consulta(parametros: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) if (valor) q.set(clave, valor);
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

export interface FiltroSesiones {
  perfil_id?: string;
  /** Fecha ISO 8601 (inclusive). */
  desde?: string;
  hasta?: string;
}

export const api = {
  salud: () => pedir<Salud>('GET', '/salud'),
  estado: () => pedir<Estado>('GET', '/estado'),

  /** Pide conectar con el casco; el progreso llega por el evento `conexion`. */
  conectar: () => ordenar('POST', '/conexion', {}),
  desconectar: () => ordenar('DELETE', '/conexion'),

  /** Pide un modo. El motor decide: el cambio real llega por el evento `modo`. */
  cambiarModo: (modo: ModoPedible) => pedir<ModoActual>('PUT', '/modo', { modo }),

  /** Inicia la calibración del centro; el progreso llega por el evento `calibracion`. */
  calibrar: () => ordenar('POST', '/calibracion', { tipo: 'centro' }),
  cancelarCalibracion: () => ordenar('DELETE', '/calibracion'),

  gestosDisponibles: () => pedir<GestosDisponibles>('GET', '/gestos/disponibles'),

  perfiles: {
    listar: () => pedir<Perfil[]>('GET', '/perfiles'),
    crear: (datos: PerfilCrear) => pedir<Perfil>('POST', '/perfiles', datos),
    obtener: (perfilId: string) => pedir<Perfil>('GET', `/perfiles/${id(perfilId)}`),
    editar: (perfilId: string, cambios: PerfilEditar) =>
      pedir<Perfil>('PATCH', `/perfiles/${id(perfilId)}`, cambios),
    eliminar: (perfilId: string) => ordenar('DELETE', `/perfiles/${id(perfilId)}`),
    activar: (perfilId: string) => pedir<Estado>('POST', `/perfiles/${id(perfilId)}/activar`),
    ajustes: (perfilId: string) => pedir<Ajustes>('GET', `/perfiles/${id(perfilId)}/ajustes`),
    /** Guarda el objeto COMPLETO; el motor lo aplica en caliente y emite `ajustes`. */
    guardarAjustes: (perfilId: string, ajustes: Ajustes) =>
      pedir<Ajustes>('PUT', `/perfiles/${id(perfilId)}/ajustes`, ajustes),
  },

  sesiones: {
    crear: (tipo: TipoSesion) => pedir<Sesion>('POST', '/sesiones', { tipo }),
    /** Cierra la sesión; el motor calcula y devuelve sus métricas. */
    finalizar: (sesionId: string) => pedir<Sesion>('POST', `/sesiones/${id(sesionId)}/finalizar`),
    listar: (filtro: FiltroSesiones = {}) =>
      pedir<Sesion[]>('GET', `/sesiones${consulta({ ...filtro })}`),
    obtener: (sesionId: string) => pedir<Sesion>('GET', `/sesiones/${id(sesionId)}`),
    agregarIntentos: (sesionId: string, intentos: Intento[]) =>
      ordenar('POST', `/sesiones/${id(sesionId)}/intentos`, intentos),
    agregarEnunciado: (sesionId: string, enunciado: Enunciado) =>
      ordenar('POST', `/sesiones/${id(sesionId)}/enunciados`, enunciado),
    /** CSV con las sesiones y sus métricas, tal como lo genera el motor. */
    exportarCsv: async (perfilId?: string) =>
      (await responder('GET', `/sesiones/exportar.csv${consulta({ perfil_id: perfilId })}`)).text(),
  },

  entrenamiento: {
    iniciar: (deteccion: Deteccion, accion: string) =>
      pedir<EntrenamientoIniciado>('POST', '/entrenamiento', { deteccion, accion }),
    aceptar: (entrenamientoId: string) =>
      ordenar('POST', `/entrenamiento/${id(entrenamientoId)}/aceptar`),
    rechazar: (entrenamientoId: string) =>
      ordenar('POST', `/entrenamiento/${id(entrenamientoId)}/rechazar`),
  },

  /** Voz de respaldo del motor (SAPI), para cuando el navegador no tiene voz local en español. */
  voz: {
    hablar: (texto: string) => ordenar('POST', '/voz/hablar', { texto }),
  },

  /** Solo existen con el motor en `--demo`. */
  dev: {
    simularGesto: (gesto: string) => ordenar('POST', '/dev/simular/gesto', { gesto }),
    simularCabeza: (yaw: number, pitch: number) =>
      ordenar('POST', '/dev/simular/cabeza', { yaw, pitch }),
    simularContacto: (malo: boolean) => ordenar('POST', '/dev/simular/contacto', { malo }),
  },
};

export type Api = typeof api;
