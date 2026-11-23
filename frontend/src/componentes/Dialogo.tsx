import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import estilos from './Dialogo.module.css';

const ENFOCABLES =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface PropsDialogo {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  /** Botones del pie (Cancelar, Guardar…). */
  acciones?: ReactNode;
  children: ReactNode;
}

/**
 * Ventana modal accesible: mueve el foco dentro al abrir, lo mantiene dentro mientras está
 * abierta (Tab no se escapa), se cierra con Escape o pulsando fuera y, al cerrar, devuelve el
 * foco a lo que lo abrió.
 */
export function Dialogo({ abierto, titulo, onCerrar, acciones, children }: PropsDialogo) {
  const idTitulo = useId();
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const primero = caja.current?.querySelector<HTMLElement>(
      '[data-autofocus], input, select, textarea',
    );
    (primero ?? caja.current)?.focus();
    return () => antes?.focus();
  }, [abierto]);

  if (!abierto) return null;

  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onCerrar();
      return;
    }
    if (evento.key !== 'Tab' || !caja.current) return;
    const enfocables = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    const primero = enfocables[0];
    const ultimo = enfocables.at(-1);
    if (!primero || !ultimo) return;
    if (
      evento.shiftKey &&
      (document.activeElement === primero || document.activeElement === caja.current)
    ) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };

  return (
    // El fondo no es un control: solo atiende el clic fuera de la caja y las teclas que suben
    // desde ella (Escape y Tab), que es el patrón estándar de un diálogo modal.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={estilos.fondo}
      onKeyDown={alTeclear}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        className={estilos.caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <h2 id={idTitulo}>{titulo}</h2>
        <div className={estilos.cuerpo}>{children}</div>
        {acciones && <div className={estilos.acciones}>{acciones}</div>}
      </div>
    </div>
  );
}
