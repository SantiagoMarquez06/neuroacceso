import type { EntradaRegistro } from '../estado/motor';
import { formatoHora } from '../textos';
import estilos from './ListaEventos.module.css';

interface PropsListaEventos {
  /** El más reciente primero. */
  entradas: EntradaRegistro[];
  /** Texto cuando aún no hay nada. */
  vacio?: string;
  etiqueta?: string;
}

/** Registro de lo que el sistema entendió, con hora. Lo último aparece arriba. */
export function ListaEventos({
  entradas,
  vacio = 'Aquí aparecerá cada gesto que el sistema reconozca.',
  etiqueta = 'Registro de eventos',
}: PropsListaEventos) {
  if (entradas.length === 0) return <p className={estilos.vacio}>{vacio}</p>;
  return (
    // Desplazable con el teclado: por eso recibe el foco.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <ol className={estilos.lista} role="log" aria-label={etiqueta} tabIndex={0}>
      {entradas.map((entrada) => (
        <li key={entrada.id} className={estilos[entrada.tono]}>
          <time className="numeros" dateTime={new Date(entrada.t).toISOString()}>
            {formatoHora(entrada.t)}
          </time>
          <span>{entrada.texto}</span>
        </li>
      ))}
    </ol>
  );
}
