// Tarea de puntería multidireccional de ISO 9241-411 (lógica pura, sin pantalla).
//
// N objetivos iguales en círculo; se alternan opuestos (0 → el de enfrente → el de al lado del 0…)
// para que cada movimiento cruce el círculo. Cada combinación de amplitud (diámetro del círculo)
// y ancho del objetivo es una "condición"; el motor calcula el rendimiento por condición.
import type { Intento } from '../../api/tipos';

export interface Punto {
  x: number;
  y: number;
}

export interface Bloque {
  /** Ancho (diámetro) del objetivo, en px CSS. */
  ancho: number;
}

/** Bloques del protocolo de pruebas (docs/protocolo-pruebas.md, T1): objetivos de 80 y 40 px. */
export const BLOQUES_PROTOCOLO: Bloque[] = [{ ancho: 80 }, { ancho: 40 }];
export const OBJETIVOS_POR_DEFECTO = 15;

/** Orden ISO: con N impar, el índice k es (k · (N+1)/2) mód N → 0, 8, 1, 9, 2… (N = 15). */
export function ordenISO(n: number): number[] {
  const salto = Math.ceil(n / 2);
  return Array.from({ length: n }, (_, k) => (k * salto) % n);
}

/** Centros de los N objetivos sobre un círculo de diámetro `amplitud`, empezando arriba. */
export function posiciones(n: number, amplitud: number, centro: Punto): Punto[] {
  return Array.from({ length: n }, (_, i) => {
    const angulo = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return {
      x: Number((centro.x + (amplitud / 2) * Math.cos(angulo)).toFixed(1)),
      y: Number((centro.y + (amplitud / 2) * Math.sin(angulo)).toFixed(1)),
    };
  });
}

/** Amplitud que cabe en el área con el objetivo más grande y un margen. */
export function amplitudPara(area: { ancho: number; alto: number }, anchoMaximo: number): number {
  const lado = Math.min(area.ancho, area.alto) - anchoMaximo - 32;
  return Math.max(200, Math.min(600, Math.round(lado)));
}

export function acierta(clic: Punto, objetivo: Punto, ancho: number): boolean {
  return Math.hypot(clic.x - objetivo.x, clic.y - objetivo.y) <= ancho / 2;
}

/**
 * Estado de un bloque en curso. El primer clic (sobre el objetivo de salida) no se mide: solo fija
 * el punto y el momento de partida del primer intento.
 */
export interface Recorrido {
  /** Paso actual: 0 = objetivo de salida; 1…N = intentos medidos. */
  paso: number;
  /** Clic anterior y su hora (ms, `performance.now()`), o null antes de salir. */
  previo: { punto: Punto; t: number } | null;
  intentos: Intento[];
}

export const RECORRIDO_INICIAL: Recorrido = { paso: 0, previo: null, intentos: [] };

export interface Tarea {
  n: number;
  amplitud: number;
  ancho: number;
  centro: Punto;
  /** Numeración global del primer intento de este bloque (los `n` siguen en toda la sesión). */
  desde: number;
  dpr: number;
}

/** Objetivo que hay que pulsar en un paso. */
export function objetivoDe(tarea: Tarea, paso: number): Punto {
  const orden = ordenISO(tarea.n);
  const indice = orden[paso % tarea.n] ?? 0;
  return posiciones(tarea.n, tarea.amplitud, tarea.centro)[indice]!;
}

/** Registra un clic. Devuelve el nuevo recorrido; `terminado` cuando ya se hicieron N intentos. */
export function registrarClic(
  tarea: Tarea,
  r: Recorrido,
  clic: Punto,
  t: number,
): { recorrido: Recorrido; terminado: boolean } {
  const objetivo = objetivoDe(tarea, r.paso);
  if (r.previo === null) {
    // Salida: hay que acertar el primer objetivo para empezar a medir.
    if (!acierta(clic, objetivo, tarea.ancho)) return { recorrido: r, terminado: false };
    return { recorrido: { paso: 1, previo: { punto: clic, t }, intentos: [] }, terminado: false };
  }
  const intento: Intento = {
    n: tarea.desde + r.intentos.length,
    t_inicio_ms: Number(r.previo.t.toFixed(1)),
    t_fin_ms: Number(t.toFixed(1)),
    objetivo: { ...objetivo, ancho: tarea.ancho },
    origen: r.previo.punto,
    clic,
    acierto: acierta(clic, objetivo, tarea.ancho),
    dpr: tarea.dpr,
  };
  const intentos = [...r.intentos, intento];
  return {
    recorrido: { paso: r.paso + 1, previo: { punto: clic, t }, intentos },
    terminado: intentos.length >= tarea.n,
  };
}
