// Cuestionario de usabilidad SUS (System Usability Scale, Brooke 1996), tal como está en
// docs/protocolo-pruebas.md §7.

export const PREGUNTAS_SUS = [
  'Creo que me gustaría usar este sistema con frecuencia.',
  'Encontré el sistema innecesariamente complejo.',
  'Pensé que el sistema era fácil de usar.',
  'Creo que necesitaría el apoyo de un técnico para poder usar este sistema.',
  'Encontré que las diversas funciones del sistema estaban bien integradas.',
  'Pensé que había demasiada inconsistencia en el sistema.',
  'Imagino que la mayoría de las personas aprendería a usar este sistema muy rápidamente.',
  'Encontré el sistema muy difícil de usar.',
  'Me sentí muy seguro usando el sistema.',
  'Necesité aprender muchas cosas antes de poder empezar a usar el sistema.',
] as const;

/** Respuestas de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo); null = sin responder. */
export type Respuestas = (number | null)[];

/**
 * Puntuación SUS de 0 a 100: ítems impares → (valor − 1); pares → (5 − valor); suma × 2,5.
 * `null` si falta alguna respuesta.
 */
export function puntuacionSUS(respuestas: Respuestas): number | null {
  if (respuestas.length !== 10 || respuestas.some((r) => r === null || r < 1 || r > 5)) return null;
  const suma = (respuestas as number[]).reduce(
    (total, valor, i) => total + (i % 2 === 0 ? valor - 1 : 5 - valor),
    0,
  );
  return suma * 2.5;
}

/** Interpretación breve (68 es la media de referencia). */
export function interpretarSUS(puntuacion: number): string {
  if (puntuacion >= 80.3) return 'Excelente: muy por encima del promedio';
  if (puntuacion >= 68) return 'Buena: por encima del promedio (68)';
  if (puntuacion >= 51) return 'Aceptable, pero por debajo del promedio (68)';
  return 'Baja: hay problemas de usabilidad que revisar';
}

export interface RespuestaGuardada {
  participante: string;
  fecha: string;
  respuestas: number[];
  puntuacion: number;
}

const CLAVE = 'neuroacceso.encuestas-sus';

export function leerEncuestas(): RespuestaGuardada[] {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(valor) ? (valor as RespuestaGuardada[]) : [];
  } catch {
    return [];
  }
}

export function guardarEncuesta(respuesta: RespuestaGuardada): RespuestaGuardada[] {
  const todas = [...leerEncuestas(), respuesta];
  localStorage.setItem(CLAVE, JSON.stringify(todas));
  return todas;
}

/** CSV con una fila por encuesta: participante, fecha, p1…p10, puntuación. */
export function encuestasCsv(encuestas: RespuestaGuardada[]): string {
  const cabecera = ['participante', 'fecha', ...PREGUNTAS_SUS.map((_, i) => `p${i + 1}`), 'sus'];
  const escapar = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const filas = encuestas.map((e) =>
    [escapar(e.participante), e.fecha, ...e.respuestas.map(String), String(e.puntuacion)].join(','),
  );
  return [cabecera.join(','), ...filas].join('\r\n') + '\r\n';
}
