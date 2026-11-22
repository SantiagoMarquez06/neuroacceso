// Mismas fórmulas que el motor (backend/src/neuroacceso_motor/metricas.py), para que los mocks
// devuelvan métricas creíbles. La fuente de verdad sigue siendo el motor.
//
// Rendimiento (throughput) según ISO 9241-411 con ancho efectivo (Soukoreff y MacKenzie, 2004):
//   We = 4.133 · SD(dx)   dx = desvío del clic sobre el eje origen → objetivo
//   Ae = media de la distancia efectiva recorrida
//   IDe = log2(Ae / We + 1)   TP = IDe / MT (bits/s), promediado entre condiciones (A, W)
import type { Enunciado, Intento, Metricas } from '../api/tipos';

const media = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length;

/** Desviación estándar muestral (n − 1), como statistics.stdev de Python. */
function desviacion(valores: number[]): number {
  const m = media(valores);
  return Math.sqrt(valores.reduce((suma, v) => suma + (v - m) ** 2, 0) / (valores.length - 1));
}

export function throughput(intentos: Intento[]): number | null {
  const condiciones = new Map<string, { dx: number; ae: number; mt: number }[]>();
  for (const i of intentos) {
    const ax = i.objetivo.x - i.origen.x;
    const ay = i.objetivo.y - i.origen.y;
    const a = Math.hypot(ax, ay);
    const mt = (i.t_fin_ms - i.t_inicio_ms) / 1000;
    if (a <= 0 || mt <= 0) continue;
    const dx = ((i.clic.x - i.objetivo.x) * ax + (i.clic.y - i.objetivo.y) * ay) / a;
    const clave = `${Math.round(a)}|${Math.round(i.objetivo.ancho)}`;
    condiciones.set(clave, [...(condiciones.get(clave) ?? []), { dx, ae: a + dx, mt }]);
  }
  const rendimientos: number[] = [];
  for (const filas of condiciones.values()) {
    if (filas.length < 2) continue; // sin dispersión no hay ancho efectivo
    const we = 4.133 * desviacion(filas.map((f) => f.dx));
    if (we <= 0) continue;
    const ae = media(filas.map((f) => f.ae));
    rendimientos.push(Math.log2(ae / we + 1) / media(filas.map((f) => f.mt)));
  }
  return rendimientos.length ? media(rendimientos) : null;
}

export function calcularMetricas(
  inicio: string,
  fin: string | null,
  intentos: Intento[],
  enunciados: Enunciado[],
): Metricas {
  const m: Metricas = {
    throughput_bps: null,
    tiempo_medio_ms: null,
    precision: null,
    falsos_positivos_min: null,
    caracteres_min: null,
  };
  if (intentos.length) {
    m.throughput_bps = throughput(intentos);
    m.tiempo_medio_ms = media(intentos.map((i) => i.t_fin_ms - i.t_inicio_ms));
    const aciertos = intentos.filter((i) => i.acierto).length;
    m.precision = aciertos / intentos.length;
    const minutos = fin ? (Date.parse(fin) - Date.parse(inicio)) / 60_000 : 0;
    // Falsos positivos: clics que no alcanzaron su objetivo, por minuto de sesión.
    if (minutos > 0) m.falsos_positivos_min = (intentos.length - aciertos) / minutos;
  }
  const duracion = enunciados.reduce((suma, e) => suma + e.duracion_ms, 0);
  if (enunciados.length && duracion > 0) {
    m.caracteres_min =
      (enunciados.reduce((suma, e) => suma + e.texto.length, 0) / duracion) * 60_000;
  }
  return m;
}
