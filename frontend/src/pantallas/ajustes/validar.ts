// Reglas que evitan configuraciones peligrosas (docs/pantallas.md §4.7): la persona nunca debe
// quedar sin forma de pausar el cursor, de elegir en el comunicador o de salir (rescate).
import type { Accion, Ajustes } from '../../api/tipos';
import { NOMBRE_ACCION, nombreGesto } from '../../textos';

/** Acciones que tienen sentido en cada modo (lo demás el motor no lo ejecuta en ese modo). */
export const ACCIONES_POR_MODO: Record<'cursor' | 'comunicador', Accion[]> = {
  cursor: ['ninguna', 'clic', 'clic_derecho', 'doble_clic', 'pausar', 'cambiar_modo'],
  comunicador: ['ninguna', 'seleccionar', 'atras', 'cambiar_modo'],
};

export interface Problemas {
  /** Impiden guardar. */
  errores: string[];
  /** Se puede guardar, pero conviene revisarlos. */
  avisos: string[];
}

const usan = (mapeo: Record<string, Accion>, accion: Accion) =>
  Object.entries(mapeo)
    .filter(([, a]) => a === accion)
    .map(([g]) => g);

export function revisar(a: Ajustes): Problemas {
  const errores: string[] = [];
  const avisos: string[] = [];
  const { cursor, comunicador } = a.gestos.mapeo;

  if (usan(cursor, 'pausar').length === 0) {
    errores.push(
      'Asigna un gesto a «Pausar o reanudar» en el modo cursor: sin él no se puede detener el cursor.',
    );
  }
  if (usan(comunicador, 'seleccionar').length === 0) {
    errores.push('Asigna un gesto a «Seleccionar» en el comunicador: sin él no se puede escribir.');
  }
  if (!a.gestos.gesto_rescate) {
    errores.push(
      'Elige un gesto de rescate: es la salida de emergencia entre cursor y comunicador.',
    );
  }
  if (a.comunicador.frases.some((f) => !f.trim())) {
    errores.push('Hay una frase rápida vacía: escríbela o bórrala.');
  }

  const rescate = a.gestos.gesto_rescate;
  for (const [modo, mapeo] of [
    ['cursor', cursor],
    ['comunicador', comunicador],
  ] as const) {
    const accion = mapeo[rescate];
    if (rescate && accion && accion !== 'ninguna') {
      avisos.push(
        `${nombreGesto(rescate)} es el gesto de rescate, así que en el modo ${modo} no hará «${NOMBRE_ACCION[accion]}».`,
      );
    }
  }
  return { errores, avisos };
}

/** Asigna una acción a un gesto en un modo ("ninguna" lo quita del mapeo). */
export function asignar(
  a: Ajustes,
  modo: 'cursor' | 'comunicador',
  gesto: string,
  accion: Accion,
): Ajustes {
  const nuevo = structuredClone(a);
  if (accion === 'ninguna') delete nuevo.gestos.mapeo[modo][gesto];
  else nuevo.gestos.mapeo[modo][gesto] = accion;
  return nuevo;
}
