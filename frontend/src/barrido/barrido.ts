// Motor de barrido (docs/pantallas.md §3.3): usar una pantalla con UNA sola señal.
//
//   1. Se resalta un GRUPO cada `tiempoMs`.
//   2. `seleccionar` → entra en el grupo y se resaltan sus ELEMENTOS uno a uno.
//   3. `seleccionar` → activa el elemento resaltado y vuelve al primer nivel.
//   4. Si recorre todo el grupo sin selección, vuelve al primer nivel.
//   5. `atras` → sube un nivel.
//
// Este archivo es lógica pura (sin React ni temporizadores): se prueba paso a paso.
// El hook useBarrido.ts le pone el reloj.

export type NivelBarrido = 'grupos' | 'elementos';

export interface EstadoBarrido {
  nivel: NivelBarrido;
  /** Grupo resaltado (nivel `grupos`) o en el que se entró (nivel `elementos`). */
  grupo: number;
  /** Elemento resaltado dentro del grupo; solo vale en el nivel `elementos`. */
  elemento: number;
}

/** Coordenadas de un elemento activado. */
export interface Activacion {
  grupo: number;
  elemento: number;
}

export const INICIAL: EstadoBarrido = { nivel: 'grupos', grupo: 0, elemento: 0 };

/** Índice del siguiente grupo con elementos (los vacíos se saltan), o -1 si no hay ninguno. */
function siguienteGrupo(tamanos: readonly number[], desde: number): number {
  const n = tamanos.length;
  for (let paso = 0; paso < n; paso += 1) {
    const i = (((desde + paso) % n) + n) % n;
    if ((tamanos[i] ?? 0) > 0) return i;
  }
  return -1;
}

/** Ajusta el estado si los grupos cambiaron de tamaño (p. ej. menos sugerencias de palabras). */
export function normalizar(estado: EstadoBarrido, tamanos: readonly number[]): EstadoBarrido {
  const grupo = siguienteGrupo(tamanos, estado.grupo);
  if (grupo < 0) return INICIAL;
  if (grupo !== estado.grupo) return { nivel: 'grupos', grupo, elemento: 0 };
  if (estado.nivel === 'elementos' && estado.elemento >= (tamanos[grupo] ?? 0)) {
    return { nivel: 'grupos', grupo, elemento: 0 };
  }
  return estado;
}

/** Un paso del reloj: resalta lo siguiente. */
export function avanzar(estado: EstadoBarrido, tamanos: readonly number[]): EstadoBarrido {
  const actual = normalizar(estado, tamanos);
  if (actual.nivel === 'grupos') {
    const grupo = siguienteGrupo(tamanos, actual.grupo + 1);
    return grupo < 0 ? INICIAL : { nivel: 'grupos', grupo, elemento: 0 };
  }
  const elemento = actual.elemento + 1;
  if (elemento < (tamanos[actual.grupo] ?? 0)) return { ...actual, elemento };
  // Recorrió el grupo entero sin seleccionar: vuelve a los grupos, empezando por este.
  return { nivel: 'grupos', grupo: actual.grupo, elemento: 0 };
}

/**
 * La persona hizo el gesto de seleccionar. En un grupo de un solo elemento se activa ese
 * elemento directamente: entrar para elegir lo único que hay sería un gesto de más.
 */
export function seleccionar(
  estado: EstadoBarrido,
  tamanos: readonly number[],
): { estado: EstadoBarrido; activado: Activacion | null } {
  const actual = normalizar(estado, tamanos);
  if (siguienteGrupo(tamanos, 0) < 0) return { estado: INICIAL, activado: null };

  if (actual.nivel === 'grupos' && (tamanos[actual.grupo] ?? 0) > 1) {
    return { estado: { nivel: 'elementos', grupo: actual.grupo, elemento: 0 }, activado: null };
  }
  const activado = {
    grupo: actual.grupo,
    elemento: actual.nivel === 'elementos' ? actual.elemento : 0,
  };
  // Tras activar, vuelve al primer grupo: el recorrido empieza siempre igual y es predecible.
  return { estado: { ...INICIAL, grupo: siguienteGrupo(tamanos, 0) }, activado };
}

/** Sube un nivel: de los elementos al grupo en el que estaba. En los grupos, al primero. */
export function atras(estado: EstadoBarrido, tamanos: readonly number[]): EstadoBarrido {
  const actual = normalizar(estado, tamanos);
  if (actual.nivel === 'elementos') return { nivel: 'grupos', grupo: actual.grupo, elemento: 0 };
  return { ...INICIAL, grupo: Math.max(0, siguienteGrupo(tamanos, 0)) };
}

/** Cómo se ve un elemento: resaltado su grupo, activo, o en reposo. */
export function resaltadoDe(
  estado: EstadoBarrido,
  grupo: number,
  elemento: number,
): 'grupo' | 'activo' | undefined {
  if (estado.grupo !== grupo) return undefined;
  if (estado.nivel === 'grupos') return 'grupo';
  return estado.elemento === elemento ? 'activo' : undefined;
}

/** Cómo se ve el marco de un grupo. */
export function resaltadoDeGrupo(
  estado: EstadoBarrido,
  grupo: number,
): 'grupo' | 'activo' | undefined {
  if (estado.grupo !== grupo) return undefined;
  return estado.nivel === 'grupos' ? 'grupo' : 'activo';
}
