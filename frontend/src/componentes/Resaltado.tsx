import type { ReactNode } from 'react';
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
 */
export function Resaltado({ nivel, etiqueta, className, children }: PropsResaltado) {
  const clases = [estilos.marco, nivel && estilos[nivel], className].filter(Boolean).join(' ');
  return (
    <div className={clases} role="group" aria-label={etiqueta} data-barrido={nivel}>
      {children}
    </div>
  );
}
