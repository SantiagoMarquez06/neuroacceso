// Resumen del estado del sistema en palabras, para la barra superior y la barra flotante.
import type { TonoIndicador } from '../componentes';
import type { EstadoMotor } from '../estado/motor';

export interface Resumen {
  tono: TonoIndicador;
  texto: string;
}

/** ¿Hay conexión con el casco? */
export function resumenConexion(s: EstadoMotor): Resumen {
  if (s.enlace.estado !== 'abierto' || !s.estado) {
    return { tono: 'mal', texto: 'Sin conexión con NeuroAcceso' };
  }
  switch (s.estado.conexion.estado) {
    case 'conectado':
      return { tono: 'bien', texto: 'Casco conectado' };
    case 'conectando':
      return { tono: 'aviso', texto: 'Buscando el casco…' };
    case 'error':
      return { tono: 'mal', texto: 'Sin casco' };
    default:
      return { tono: 'apagado', texto: 'Casco desconectado' };
  }
}

/** ¿Qué está haciendo el sistema ahora? `null` si no hay casco (ya lo dice la conexión). */
export function resumenModo(s: EstadoMotor): Resumen | null {
  if (s.enlace.estado !== 'abierto' || !s.estado) return null;
  switch (s.estado.modo) {
    case 'cursor':
      return { tono: 'bien', texto: 'Cursor activo' };
    case 'comunicador':
      return { tono: 'accion', texto: 'Comunicador' };
    case 'pausa':
      return { tono: 'aviso', texto: 'En pausa' };
    case 'calibrando':
      return { tono: 'aviso', texto: 'Calibrando' };
    case 'entrenando':
      return { tono: 'aviso', texto: 'Entrenando' };
    default:
      return null;
  }
}

export const CONTACTO_BUENO = 80;
export const CONTACTO_MINIMO = 50;

/** Calidad global de contacto (0–100) en palabras. `null` si aún no hay datos del casco. */
export function resumenContacto(s: EstadoMotor): Resumen | null {
  const calidad = s.dispositivo?.calidad_global;
  if (calidad === undefined) return null;
  const tono = calidad >= CONTACTO_BUENO ? 'bien' : calidad >= CONTACTO_MINIMO ? 'aviso' : 'mal';
  return { tono, texto: `Contacto ${calidad} %` };
}
