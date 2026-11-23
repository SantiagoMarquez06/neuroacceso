// Textos en español claro para todo lo que viene del motor en forma de código.
// Regla (docs/pantallas.md §1.8): sin jerga técnica en lo que ve el usuario principal.
import type { CodigoApi } from './api/rest';
import type {
  Accion,
  EstadoConexion,
  EvAccion,
  EvModo,
  Modo,
  Sensor,
  TipoSesion,
} from './api/tipos';
import { SENSORES } from './api/tipos';

// ---- Gestos --------------------------------------------------------------------------------
const GESTOS: Record<string, { nombre: string; orden: string }> = {
  // nombre: cómo se muestra · orden: cómo se le pide a la persona que lo haga
  neutral: { nombre: 'Relajado', orden: 'Relaja la cara' },
  blink: { nombre: 'Parpadeo', orden: 'Parpadea' },
  winkL: { nombre: 'Guiño izquierdo', orden: 'Guiña el ojo izquierdo' },
  winkR: { nombre: 'Guiño derecho', orden: 'Guiña el ojo derecho' },
  lookL: { nombre: 'Mirar a la izquierda', orden: 'Mira a la izquierda' },
  lookR: { nombre: 'Mirar a la derecha', orden: 'Mira a la derecha' },
  surprise: { nombre: 'Cejas arriba', orden: 'Levanta las cejas' },
  frown: { nombre: 'Ceño fruncido', orden: 'Frunce el ceño' },
  clench: { nombre: 'Apretar la mandíbula', orden: 'Aprieta la mandíbula' },
  smile: { nombre: 'Sonrisa', orden: 'Sonríe' },
  laugh: { nombre: 'Risa', orden: 'Ríe' },
  smirkLeft: { nombre: 'Media sonrisa izquierda', orden: 'Sonríe solo con el lado izquierdo' },
  smirkRight: { nombre: 'Media sonrisa derecha', orden: 'Sonríe solo con el lado derecho' },
  push: { nombre: 'Empujar (mental)', orden: 'Imagina que empujas el cubo' },
  pull: { nombre: 'Atraer (mental)', orden: 'Imagina que atraes el cubo hacia ti' },
  lift: { nombre: 'Levantar (mental)', orden: 'Imagina que levantas el cubo' },
  drop: { nombre: 'Bajar (mental)', orden: 'Imagina que bajas el cubo' },
  left: { nombre: 'Izquierda (mental)', orden: 'Imagina que mueves el cubo a la izquierda' },
  right: { nombre: 'Derecha (mental)', orden: 'Imagina que mueves el cubo a la derecha' },
  permanencia: { nombre: 'Quedarse quieto', orden: 'Deja el cursor quieto sobre el objetivo' },
};

/** Nombre de un gesto para mostrar ("Guiño derecho"). Un gesto desconocido se muestra tal cual. */
export const nombreGesto = (gesto: string): string => GESTOS[gesto]?.nombre ?? gesto;

/** Instrucción para hacer un gesto ("Guiña el ojo derecho"). */
export const ordenGesto = (gesto: string): string =>
  GESTOS[gesto]?.orden ?? `Haz el gesto ${gesto}`;

// ---- Acciones ------------------------------------------------------------------------------
export const NOMBRE_ACCION: Record<Accion, string> = {
  clic: 'Clic',
  clic_derecho: 'Clic derecho',
  doble_clic: 'Doble clic',
  pausar: 'Pausar o reanudar',
  seleccionar: 'Seleccionar',
  atras: 'Atrás',
  cambiar_modo: 'Cambiar entre cursor y comunicador',
  ninguna: 'Ninguna',
};

const MOTIVO_NO_EJECUTADA: Record<NonNullable<EvAccion['motivo']>, string> = {
  pausado: 'el cursor está en pausa',
  cooldown: 'fue demasiado seguido de la anterior',
  bajo_umbral: 'el gesto fue muy suave',
};

/** Frase corta de retroalimentación para una acción: "Apretar la mandíbula → Clic". */
export function describirAccion(accion: EvAccion): string {
  const origen = nombreGesto(accion.origen.nombre);
  const nombre = NOMBRE_ACCION[accion.accion] ?? accion.accion;
  if (accion.ejecutada) return `${origen} → ${nombre}`;
  const motivo = accion.motivo ? MOTIVO_NO_EJECUTADA[accion.motivo] : 'no aplica en este modo';
  return `${origen}: no se hizo «${nombre}» porque ${motivo}`;
}

// ---- Modos y conexión ----------------------------------------------------------------------
export const NOMBRE_MODO: Record<Modo, string> = {
  desconectado: 'Sin casco',
  calibrando: 'Calibrando',
  cursor: 'Cursor',
  comunicador: 'Comunicador',
  pausa: 'En pausa',
  entrenando: 'Entrenando',
};

export const MOTIVO_MODO: Record<EvModo['motivo'], string> = {
  usuario: 'lo pediste tú',
  gesto_rescate: 'gesto de rescate',
  ui_desconectada: 'se cerró la ventana del comunicador',
  calibracion: 'calibración',
  entrenamiento: 'entrenamiento',
  conexion: 'cambió la conexión con el casco',
};

export const NOMBRE_CONEXION: Record<EstadoConexion, string> = {
  desconectado: 'Casco desconectado',
  conectando: 'Buscando el casco…',
  conectado: 'Casco conectado',
  error: 'Sin conexión con el casco',
};

// ---- Errores -------------------------------------------------------------------------------
/** Qué pasó y QUÉ HACER, para cada código de error. Nunca se muestra un JSON ni un código. */
export const ERRORES: Record<CodigoApi, { titulo: string; ayuda: string }> = {
  CORTEX_NO_DISPONIBLE: {
    titulo: 'No se encuentra el programa de Emotiv',
    ayuda: 'Abre el EMOTIV Launcher e inicia sesión. NeuroAcceso volverá a intentarlo solo.',
  },
  APP_NO_APROBADA: {
    titulo: 'Falta dar permiso a NeuroAcceso',
    ayuda: 'En el EMOTIV Launcher, aprueba la aplicación NeuroAcceso cuando lo pida.',
  },
  SIN_CASCO: {
    titulo: 'No se encuentra el casco',
    ayuda: 'Enciende el casco y comprueba que el receptor USB está conectado.',
  },
  CASCO_DESCONECTADO: {
    titulo: 'El casco se desconectó',
    ayuda: 'Revisa que esté encendido y con batería. Se volverá a conectar solo.',
  },
  TOKEN_CORTEX_EXPIRADO: {
    titulo: 'La sesión de Emotiv caducó',
    ayuda: 'Abre el EMOTIV Launcher y vuelve a iniciar sesión.',
  },
  PERFIL_NO_ENCONTRADO: {
    titulo: 'Ese perfil ya no existe',
    ayuda: 'Elige otro perfil o crea uno nuevo.',
  },
  MODO_INVALIDO: {
    titulo: 'Ahora no se puede hacer eso',
    ayuda:
      'Espera a que termine la calibración o el entrenamiento, y a que el casco esté conectado.',
  },
  VALIDACION: {
    titulo: 'Hay un dato que no es válido',
    ayuda: 'Revisa lo que escribiste e inténtalo de nuevo.',
  },
  NO_AUTORIZADO: {
    titulo: 'Esta ventana perdió el permiso',
    ayuda: 'Cierra esta ventana y abre NeuroAcceso de nuevo.',
  },
  ORIGEN_NO_PERMITIDO: {
    titulo: 'Esta ventana no puede usar NeuroAcceso',
    ayuda: 'Abre NeuroAcceso desde su acceso directo, no desde otra dirección.',
  },
  MOTOR_NO_DISPONIBLE: {
    titulo: 'No se puede conectar con NeuroAcceso',
    ayuda: 'El programa principal no responde. Se está reintentando solo.',
  },
  DESCONOCIDO: {
    titulo: 'Algo salió mal',
    ayuda: 'Inténtalo de nuevo. Si se repite, cierra y vuelve a abrir NeuroAcceso.',
  },
};

// ---- Sensores ------------------------------------------------------------------------------
/** Zona de la cabeza de cada sensor, en palabras que no exigen conocer el sistema 10-20. */
export const ZONA_SENSOR: Record<Sensor, string> = {
  AF3: 'frente izquierda',
  AF4: 'frente derecha',
  F7: 'sien izquierda',
  F8: 'sien derecha',
  F3: 'parte alta izquierda',
  F4: 'parte alta derecha',
  FC5: 'lado izquierdo',
  FC6: 'lado derecho',
  T7: 'sobre la oreja izquierda',
  T8: 'sobre la oreja derecha',
  P7: 'detrás de la oreja izquierda',
  P8: 'detrás de la oreja derecha',
  O1: 'nuca izquierda',
  O2: 'nuca derecha',
};

export type NivelContacto = 'bueno' | 'regular' | 'malo' | 'sin_senal';

/** Calidad de contacto de un sensor (0–4 del contrato) en tres niveles + sin señal. */
export function nivelContacto(valor: number | undefined): NivelContacto {
  if (valor === undefined || valor <= 0) return 'sin_senal';
  if (valor >= 4) return 'bueno';
  if (valor >= 2) return 'regular';
  return 'malo';
}

/** Zonas de la cabeza que hay que revisar, en palabras ("sobre la oreja izquierda"). */
export function zonasPorRevisar(contacto: Record<string, number> | null): string[] {
  if (!contacto) return [];
  return SENSORES.filter((sensor) => {
    const nivel = nivelContacto(contacto[sensor]);
    return nivel === 'malo' || nivel === 'sin_senal';
  }).map((sensor) => ZONA_SENSOR[sensor]);
}

export const NOMBRE_CONTACTO: Record<NivelContacto, string> = {
  bueno: 'Buen contacto',
  regular: 'Contacto regular',
  malo: 'Mal contacto',
  sin_senal: 'Sin contacto',
};

// ---- Sesiones ------------------------------------------------------------------------------
export const NOMBRE_SESION: Record<TipoSesion, string> = {
  libre: 'Uso libre',
  practica: 'Práctica de puntería',
  comunicador: 'Comunicador',
};

// ---- Formato -------------------------------------------------------------------------------
const HORA = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const FECHA_HORA = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

export const formatoHora = (ms: number): string => HORA.format(ms);
export const formatoFechaHora = (iso: string): string => FECHA_HORA.format(new Date(iso));

/** "hace 2 días", "hace 1 hora", "ahora". */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const segundos = Math.round((new Date(iso).getTime() - ahora) / 1000);
  const pasos: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unidad, tamano] of pasos) {
    if (Math.abs(segundos) >= tamano) return RELATIVO.format(Math.round(segundos / tamano), unidad);
  }
  return 'ahora';
}

/** Duración legible: "45 s", "6 min", "1 h 05 min". */
export function formatoDuracion(ms: number): string {
  const segundos = Math.max(0, Math.round(ms / 1000));
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

const NUMERO = (decimales: number) =>
  new Intl.NumberFormat('es', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

/** Número con coma decimal, o "—" si no hay dato. */
export function formatoNumero(valor: number | null | undefined, decimales = 1): string {
  return valor === null || valor === undefined ? '—' : NUMERO(decimales).format(valor);
}

/** Proporción 0–1 como porcentaje: 0.93 → "93 %". */
export function formatoPorcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : `${Math.round(valor * 100)} %`;
}
