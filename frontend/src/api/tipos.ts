// Nombres cómodos para los tipos del contrato. Todos salen de generado/contrato.ts, que se
// genera desde ../contrato: aquí no se define ninguna forma de datos a mano.
import type { components } from './generado/contrato';

type Esquemas = components['schemas'];

// ---- REST ----------------------------------------------------------------------------------
export type Salud = Esquemas['Salud'];
export type Estado = Esquemas['Estado'];
export type Conexion = Esquemas['Conexion'];
export type Perfil = Esquemas['Perfil'];
export type PerfilCrear = Esquemas['PerfilCrear'];
export type PerfilEditar = Esquemas['PerfilEditar'];
export type Ajustes = Esquemas['Ajustes'];
export type ModoActual = Esquemas['ModoActual'];
export type GestosDisponibles = Esquemas['GestosDisponibles'];
export type Sesion = Esquemas['Sesion'];
export type Metricas = Esquemas['Metricas'];
export type Intento = Esquemas['Intento'];
export type Enunciado = Esquemas['Enunciado'];
export type EntrenamientoIniciado = Esquemas['EntrenamientoIniciado'];
export type CuerpoError = Esquemas['Error'];

export type Modo = Estado['modo'];
/** Modos que la interfaz puede pedir; el resto los decide el motor. */
export type ModoPedible = Esquemas['CambioModo']['modo'];
export type EstadoConexion = Conexion['estado'];
export type Accion = Esquemas['EvAccion']['accion'];
export type CodigoError = CuerpoError['codigo'];
export type TipoSesion = Sesion['tipo'];
export type Deteccion = Esquemas['PedirEntrenamiento']['deteccion'];
export type Disposicion = Ajustes['comunicador']['disposicion'];

// ---- Eventos WebSocket ---------------------------------------------------------------------
/** Datos de cada evento, por su campo `tipo`. */
export type DatosEvento = Esquemas['EventosWs'];
export type TipoEvento = keyof DatosEvento;

export type EvHola = DatosEvento['hola'];
export type EvConexion = DatosEvento['conexion'];
export type EvDispositivo = DatosEvento['dispositivo'];
export type EvOrientacion = DatosEvento['orientacion'];
export type EvGesto = DatosEvento['gesto'];
export type EvAccion = DatosEvento['accion'];
export type EvEntrada = DatosEvento['entrada'];
export type EvModo = DatosEvento['modo'];
export type EvCalibracion = DatosEvento['calibracion'];
export type EvAjustes = DatosEvento['ajustes'];
export type EvError = DatosEvento['error'];
export type EvEntrenamiento = DatosEvento['entrenamiento'];

/** Envoltorio común de todo mensaje del WebSocket. */
export interface Sobre<K extends TipoEvento = TipoEvento> {
  v: 1;
  tipo: K;
  /** Crece de uno en uno por conexión. */
  seq: number;
  /** Hora del servidor, en ms desde epoch. */
  t: number;
  datos: DatosEvento[K];
}

/** Cualquier evento conocido: al comprobar `tipo`, TypeScript sabe la forma de `datos`. */
export type Evento = { [K in TipoEvento]: Sobre<K> }[TipoEvento];

export const TIPOS_EVENTO = [
  'hola',
  'conexion',
  'dispositivo',
  'orientacion',
  'gesto',
  'accion',
  'entrada',
  'modo',
  'calibracion',
  'ajustes',
  'error',
  'entrenamiento',
] as const satisfies readonly TipoEvento[];

/** Los 14 sensores del EPOC X, en el orden del contrato. */
export const SENSORES = [
  'AF3',
  'F7',
  'F3',
  'FC5',
  'T7',
  'P7',
  'O1',
  'O2',
  'P8',
  'T8',
  'FC6',
  'F4',
  'F8',
  'AF4',
] as const;
export type Sensor = (typeof SENSORES)[number];
