// Orientación de la cabeza. Llega hasta 20 veces por segundo, así que NO vive en el almacén
// principal: quien la muestra se suscribe aquí y actualiza solo su trozo de pantalla.
import type { EvOrientacion } from '../api/tipos';

type Oyente = (orientacion: EvOrientacion) => void;

/** Grados de giro que llevan el punto del indicador hasta el borde de su recuadro. */
const RANGO_GRADOS = 30;

/** Posición del punto del indicador (−1 a 1 en cada eje) para una orientación dada. */
export function posicionPunto({ yaw, pitch }: Pick<EvOrientacion, 'yaw' | 'pitch'>) {
  const acotar = (v: number) => Math.min(1, Math.max(-1, v / RANGO_GRADOS));
  // Mirar hacia arriba (pitch positivo) sube el punto: en pantalla, "arriba" es y negativo.
  return { x: acotar(yaw), y: -acotar(pitch) };
}

const oyentes = new Set<Oyente>();
let actual: EvOrientacion = { yaw: 0, pitch: 0, calibrado: false };

export const orientacion = {
  leer: (): EvOrientacion => actual,

  fijar(nueva: EvOrientacion): void {
    actual = nueva;
    for (const oyente of oyentes) oyente(nueva);
  },

  /** Avisa en cada cambio (sin pasar por React). Devuelve la función para dejar de escuchar. */
  suscribir(oyente: Oyente): () => void {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
  },
};
