// Lo que la interfaz sabe del motor en cada momento. Se alimenta SOLO de los eventos del
// WebSocket: la interfaz pide cosas por REST, pero se entera de lo que pasó por aquí. Así dos
// ventanas (la principal y la barra flotante) muestran siempre lo mismo.
import { create } from 'zustand';
import type { InfoEnlace } from '../api/eventos';
import type {
  Ajustes,
  CodigoError,
  Estado,
  EvAccion,
  EvCalibracion,
  EvDispositivo,
  EvEntrenamiento,
  EvError,
  EvGesto,
  Evento,
} from '../api/tipos';
import { describirAccion, MOTIVO_MODO, NOMBRE_CONEXION, NOMBRE_MODO, nombreGesto } from '../textos';

export type Tono = 'neutro' | 'bien' | 'aviso' | 'mal';

/** Una línea del registro de eventos de la pantalla Estado. */
export interface EntradaRegistro {
  id: number;
  /** Hora del servidor (ms). */
  t: number;
  texto: string;
  tono: Tono;
  /** Gesto que originó la línea; permite completarla cuando llega su acción. */
  gesto?: string;
}

/** Datos de un evento junto con su hora, para saber cuán reciente es. */
export type ConHora<T> = T & { t: number };

export interface EstadoMotor {
  /** Estado del WebSocket con el motor. */
  enlace: InfoEnlace;
  version: string | null;
  /** `null` hasta que llega el primer `hola`. */
  estado: Estado | null;
  /** Código del último error de conexión con el casco, si lo hay. */
  codigoConexion: CodigoError | null;
  /** Ajustes del perfil activo. */
  ajustes: Ajustes | null;
  dispositivo: EvDispositivo | null;
  gesto: ConHora<EvGesto> | null;
  accion: ConHora<EvAccion> | null;
  calibracion: EvCalibracion | null;
  entrenamiento: EvEntrenamiento | null;
  error: ConHora<EvError> | null;
  /** Últimos eventos, el más reciente primero. */
  registro: EntradaRegistro[];
}

export const MAX_REGISTRO = 100;
/** Una acción que llega poco después de su gesto se anota en la misma línea del registro. */
const VENTANA_GESTO_ACCION_MS = 2000;

export const ESTADO_INICIAL: EstadoMotor = {
  enlace: { estado: 'inactivo', intentos: 0, esperaMs: null },
  version: null,
  estado: null,
  codigoConexion: null,
  ajustes: null,
  dispositivo: null,
  gesto: null,
  accion: null,
  calibracion: null,
  entrenamiento: null,
  error: null,
  registro: [],
};

let siguienteId = 1;

function anotar(
  registro: EntradaRegistro[],
  entrada: Omit<EntradaRegistro, 'id'>,
): EntradaRegistro[] {
  return [{ ...entrada, id: siguienteId++ }, ...registro].slice(0, MAX_REGISTRO);
}

/** Nuevo estado tras un evento del motor. Función pura: se prueba sin WebSocket ni React. */
export function reducir(previo: EstadoMotor, evento: Evento): EstadoMotor {
  const { t } = evento;
  switch (evento.tipo) {
    case 'hola': {
      const { estado, ajustes, version } = evento.datos;
      return {
        ...previo,
        version,
        estado,
        ajustes,
        codigoConexion: estado.conexion.estado === 'error' ? previo.codigoConexion : null,
        dispositivo: estado.conexion.estado === 'conectado' ? previo.dispositivo : null,
        calibracion: estado.modo === 'calibrando' ? previo.calibracion : null,
        entrenamiento: estado.modo === 'entrenando' ? previo.entrenamiento : null,
      };
    }

    case 'conexion': {
      if (!previo.estado) return previo;
      const { codigo, ...conexion } = evento.datos;
      const cambio = conexion.estado !== previo.estado.conexion.estado;
      return {
        ...previo,
        estado: { ...previo.estado, conexion },
        codigoConexion: conexion.estado === 'error' ? codigo : null,
        dispositivo: conexion.estado === 'conectado' ? previo.dispositivo : null,
        registro: cambio
          ? anotar(previo.registro, {
              t,
              texto: NOMBRE_CONEXION[conexion.estado],
              tono:
                conexion.estado === 'conectado'
                  ? 'bien'
                  : conexion.estado === 'error'
                    ? 'mal'
                    : 'neutro',
            })
          : previo.registro,
      };
    }

    case 'dispositivo':
      return { ...previo, dispositivo: evento.datos };

    case 'gesto':
      return {
        ...previo,
        gesto: { ...evento.datos, t },
        registro: anotar(previo.registro, {
          t,
          texto: `${nombreGesto(evento.datos.gesto)} (sin acción)`,
          tono: 'neutro',
          gesto: evento.datos.gesto,
        }),
      };

    case 'accion': {
      const accion = evento.datos;
      const linea = {
        t,
        texto: describirAccion(accion),
        tono: (accion.ejecutada ? 'bien' : 'aviso') as Tono,
      };
      const [ultima, ...resto] = previo.registro;
      const esDeEseGesto =
        ultima?.gesto === accion.origen.nombre && t - ultima.t <= VENTANA_GESTO_ACCION_MS;
      return {
        ...previo,
        accion: { ...accion, t },
        registro: esDeEseGesto
          ? [{ ...ultima, ...linea, gesto: undefined }, ...resto]
          : anotar(previo.registro, linea),
      };
    }

    case 'modo': {
      if (!previo.estado) return previo;
      const { modo, pausado, motivo } = evento.datos;
      return {
        ...previo,
        estado: { ...previo.estado, modo, pausado },
        entrenamiento: modo === 'entrenando' ? previo.entrenamiento : null,
        registro: anotar(previo.registro, {
          t,
          texto: `Modo: ${NOMBRE_MODO[modo]} (${MOTIVO_MODO[motivo] ?? motivo})`,
          tono: modo === 'pausa' ? 'aviso' : 'neutro',
        }),
      };
    }

    case 'calibracion': {
      const completada = evento.datos.estado === 'completada';
      return {
        ...previo,
        calibracion: evento.datos,
        estado: completada && previo.estado ? { ...previo.estado, calibrado: true } : previo.estado,
        registro:
          evento.datos.estado === 'en_curso'
            ? previo.registro
            : anotar(previo.registro, {
                t,
                texto: evento.datos.instruccion,
                tono: completada ? 'bien' : 'aviso',
              }),
      };
    }

    case 'ajustes':
      // El motor solo emite `ajustes` para el perfil activo ("" = ninguno): también es la forma
      // de enterarse de que otra ventana cambió de perfil.
      return {
        ...previo,
        ajustes: evento.datos.ajustes,
        estado: previo.estado
          ? { ...previo.estado, perfil_activo_id: evento.datos.perfil_id || null }
          : previo.estado,
      };

    case 'error':
      return {
        ...previo,
        error: { ...evento.datos, t },
        registro: anotar(previo.registro, { t, texto: evento.datos.mensaje, tono: 'mal' }),
      };

    case 'entrenamiento':
      return { ...previo, entrenamiento: evento.datos };

    // `orientacion` (20 Hz) vive en su propio almacén y `entrada` es una señal, no un estado.
    case 'orientacion':
    case 'entrada':
      return previo;

    default:
      return previo; // tipo de evento que esta versión no conoce: se ignora
  }
}

export const useMotor = create<EstadoMotor>(() => ESTADO_INICIAL);

export function aplicarEvento(evento: Evento): void {
  useMotor.setState((previo) => reducir(previo, evento));
}

export function fijarEnlace(enlace: InfoEnlace): void {
  useMotor.setState({ enlace });
}

/** Para pruebas: vuelve al estado de arranque. */
export function reiniciarMotor(): void {
  useMotor.setState(ESTADO_INICIAL, true);
}

// ---- Selectores ----------------------------------------------------------------------------
/** `true` cuando el WebSocket está abierto y ya se conoce el estado del motor. */
export const enLinea = (s: EstadoMotor): boolean =>
  s.enlace.estado === 'abierto' && s.estado !== null;

export const cascoConectado = (s: EstadoMotor): boolean =>
  s.estado?.conexion.estado === 'conectado';
