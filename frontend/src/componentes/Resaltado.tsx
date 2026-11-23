import { useEffect, useRef, type ReactNode } from 'react';
import type { NivelBarrido } from './BotonGrande';
import estilos from './Resaltado.module.css';

interface PropsResaltado {
  /** `grupo`: el barrido está sobre este grupo. `activo`: se entró en él. Sin valor: en reposo. */
  nivel?: NivelBarrido;
  /** Nombre del grupo para lectores de pantalla ("Fila 2 del teclado"). */
  etiqueta?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Marco de un grupo de barrido (una fila de teclas, las frases rápidas…). Se rodea de azul
 * cuando el barrido pasa por él y se atenúa el borde cuando se entra a recorrer sus elementos.
 * Si queda fuera de la ventana (p. ej. con el texto muy grande), se desplaza hasta verse: quien
 * usa el barrido no puede desplazar la página por su cuenta.
 */
export function Resaltado({ nivel, etiqueta, className, children }: PropsResaltado) {
  const marco = useRef<HTMLDivElement>(null);
  const clases = [estilos.marco, nivel && estilos[nivel], className].filter(Boolean).join(' ');

  useEffect(() => {
    if (nivel !== 'grupo') return;
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    marco.current?.scrollIntoView?.({ block: 'nearest', behavior: suave ? 'smooth' : 'auto' });
  }, [nivel]);

  return (
    <div ref={marco} className={clases} role="group" aria-label={etiqueta} data-barrido={nivel}>
      {children}
    </div>
  );
}
