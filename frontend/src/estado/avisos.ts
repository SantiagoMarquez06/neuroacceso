// Avisos breves y no bloqueantes (arriba de la pantalla): errores de una orden, confirmaciones.
import { create } from 'zustand';
import { ErrorApi } from '../api/rest';
import { ERRORES } from '../textos';
import type { Tono } from './motor';

export interface AvisoBreve {
  id: number;
  tono: Tono;
  titulo: string;
  detalle?: string;
}

interface EstadoAvisos {
  avisos: AvisoBreve[];
}

const DURACION_MS = 6000;
const MAXIMO = 3;
let siguienteId = 1;

export const useAvisos = create<EstadoAvisos>(() => ({ avisos: [] }));

export function cerrarAviso(id: number): void {
  useAvisos.setState(({ avisos }) => ({ avisos: avisos.filter((a) => a.id !== id) }));
}

export function avisar(aviso: Omit<AvisoBreve, 'id'>): number {
  const id = siguienteId++;
  useAvisos.setState(({ avisos }) => ({ avisos: [...avisos, { ...aviso, id }].slice(-MAXIMO) }));
  setTimeout(() => cerrarAviso(id), DURACION_MS);
  return id;
}

/** Título y ayuda en español para cualquier error; nunca un JSON ni un código. */
export function textoDeError(error: unknown): { titulo: string; ayuda: string } {
  const codigo = error instanceof ErrorApi ? error.codigo : 'DESCONOCIDO';
  return ERRORES[codigo] ?? ERRORES.DESCONOCIDO;
}

/** Muestra un aviso con lo que falló y qué hacer. Úsalo en el `catch` de una orden al motor. */
export function avisarError(error: unknown): void {
  const { titulo, ayuda } = textoDeError(error);
  avisar({ tono: 'mal', titulo, detalle: ayuda });
}
