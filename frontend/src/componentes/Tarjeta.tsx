import { useId, type ReactNode } from 'react';
import estilos from './Tarjeta.module.css';

interface PropsTarjeta {
  titulo?: string;
  /** Nivel del encabezado, según dónde esté la tarjeta en la página. */
  nivel?: 2 | 3;
  /** Controles a la derecha del título. */
  acciones?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Bloque de contenido con título. Es una región con nombre para los lectores de pantalla. */
export function Tarjeta({ titulo, nivel = 2, acciones, className, children }: PropsTarjeta) {
  const idTitulo = useId();
  const Encabezado = `h${nivel}` as const;
  return (
    <section
      className={[estilos.tarjeta, className].filter(Boolean).join(' ')}
      aria-labelledby={titulo ? idTitulo : undefined}
    >
      {(titulo || acciones) && (
        <header className={estilos.cabecera}>
          {titulo && (
            <Encabezado id={idTitulo} className={estilos.titulo}>
              {titulo}
            </Encabezado>
          )}
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
