// Hook del barrido: le pone reloj a la lógica pura de barrido.ts.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  atras as subir,
  avanzar,
  INICIAL,
  normalizar,
  resaltadoDe,
  resaltadoDeGrupo,
  seleccionar as elegir,
  type Activacion,
  type EstadoBarrido,
} from './barrido';

export interface OpcionesBarrido {
  /** Cuánto tiempo se resalta cada grupo o elemento (ajustes.comunicador.tiempo_barrido_ms). */
  tiempoMs: number;
  /** Se llama con el elemento elegido. */
  alActivar: (activacion: Activacion) => void;
  /** En pausa, el resaltado se queda quieto y no se aceptan selecciones. */
  activo?: boolean;
}

export interface Barrido {
  estado: EstadoBarrido;
  seleccionar: () => void;
  atras: () => void;
  reiniciar: () => void;
  /** Resaltado de un elemento: `grupo`, `activo` o nada. */
  resaltado: (grupo: number, elemento: number) => 'grupo' | 'activo' | undefined;
  /** Resaltado del marco de un grupo. */
  resaltadoGrupo: (grupo: number) => 'grupo' | 'activo' | undefined;
}

/**
 * Barrido reutilizable. `tamanos[i]` es el número de elementos del grupo i (un grupo vacío se
 * salta). Cada selección o vuelta atrás reinicia el reloj, para que la persona tenga siempre el
 * tiempo completo sobre lo que se acaba de resaltar.
 */
export function useBarrido(
  tamanos: readonly number[],
  { tiempoMs, alActivar, activo = true }: OpcionesBarrido,
): Barrido {
  // El estado vive en una referencia para que `seleccionar` sepa EN EL ACTO qué está resaltado
  // (un gesto puede llegar entre dos dibujos de la pantalla); `dibujar` avisa a React.
  const estadoRef = useRef<EstadoBarrido>(INICIAL);
  const [, dibujar] = useReducer((n: number) => n + 1, 0);
  const [pulso, setPulso] = useState(0); // cambia en cada orden: reinicia el temporizador
  const tamanosRef = useRef(tamanos);
  const alActivarRef = useRef(alActivar);
  useEffect(() => {
    tamanosRef.current = tamanos;
    alActivarRef.current = alActivar;
  });

  const fijar = useCallback((nuevo: EstadoBarrido) => {
    estadoRef.current = nuevo;
    dibujar();
  }, []);

  const clave = tamanos.join(',');
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => fijar(avanzar(estadoRef.current, tamanosRef.current)), tiempoMs);
    return () => clearInterval(id);
  }, [activo, tiempoMs, pulso, clave, fijar]);

  const seleccionar = useCallback(() => {
    if (!activo) return;
    const { estado, activado } = elegir(estadoRef.current, tamanosRef.current);
    fijar(estado);
    setPulso((p) => p + 1);
    if (activado) alActivarRef.current(activado);
  }, [activo, fijar]);

  const atras = useCallback(() => {
    if (!activo) return;
    fijar(subir(estadoRef.current, tamanosRef.current));
    setPulso((p) => p + 1);
  }, [activo, fijar]);

  const reiniciar = useCallback(() => {
    fijar(INICIAL);
    setPulso((p) => p + 1);
  }, [fijar]);

  // eslint-disable-next-line react-hooks/refs -- se lee en el render a propósito (ver arriba)
  const estado = normalizar(estadoRef.current, tamanos);
  return {
    estado,
    seleccionar,
    atras,
    reiniciar,
    resaltado: (g, e) => (activo ? resaltadoDe(estado, g, e) : undefined),
    resaltadoGrupo: (g) => (activo ? resaltadoDeGrupo(estado, g) : undefined),
  };
}
