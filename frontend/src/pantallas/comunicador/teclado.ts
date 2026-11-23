// Disposición del teclado del comunicador (ajustes.comunicador.disposicion).
import type { Disposicion } from '../../api/tipos';

/** Orden alfabético, en filas de seis. */
const ABC = 'ABCDEF GHIJKL MNÑOPQ RSTUVW XYZ.,?';

/**
 * Las letras más usadas del español primero: con barrido, lo que está antes se alcanza antes.
 * (Frecuencia aproximada de letras en textos en español: E A O S R N I D L C T U M P B G V Y Q
 * H F Z J Ñ X K W.)
 */
const FRECUENCIA = 'EAOSRN IDLCTU MPBGVY QHFZJÑ XKW.,?';

export function filasTeclado(disposicion: Disposicion): string[][] {
  return (disposicion === 'frecuencia' ? FRECUENCIA : ABC).split(' ').map((fila) => [...fila]);
}

export type Control = 'espacio' | 'borrar' | 'hablar' | 'limpiar' | 'salir';

export const CONTROLES: { control: Control; texto: string }[] = [
  { control: 'espacio', texto: 'Espacio' },
  { control: 'borrar', texto: 'Borrar' },
  { control: 'hablar', texto: 'Hablar' },
  { control: 'limpiar', texto: 'Limpiar' },
  { control: 'salir', texto: 'Salir' },
];

/** Orden de los grupos del barrido, de arriba abajo (docs/pantallas.md §4.4). */
export type Grupo =
  | { tipo: 'frases' }
  | { tipo: 'prediccion' }
  | { tipo: 'fila'; fila: number }
  | { tipo: 'controles' };

export function gruposDeBarrido(filas: number): Grupo[] {
  return [
    { tipo: 'frases' },
    { tipo: 'prediccion' },
    ...Array.from({ length: filas }, (_, fila) => ({ tipo: 'fila' as const, fila })),
    { tipo: 'controles' },
  ];
}
