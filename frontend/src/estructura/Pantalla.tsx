import { useEffect, type ReactNode } from 'react';
import estilos from './Pantalla.module.css';

interface PropsPantalla {
  titulo: string;
  /** Frase breve bajo el título: para qué sirve la pantalla. */
  descripcion?: string;
  /** Botones a la derecha del título. */
  acciones?: ReactNode;
  /** `ancho`: usa todo el espacio (paneles). `lectura`: columna cómoda para formularios. */
  ancho?: 'ancho' | 'lectura';
  children: ReactNode;
}

/** Marco común de cada pantalla: título (h1), título de la ventana y espaciado. */
export function Pantalla({
  titulo,
  descripcion,
  acciones,
  ancho = 'ancho',
  children,
}: PropsPantalla) {
  useEffect(() => {
    document.title = `${titulo} · NeuroAcceso`;
  }, [titulo]);

  return (
    <div className={[estilos.pantalla, estilos[ancho]].join(' ')}>
      <div className={estilos.cabecera}>
        <div>
          <h1>{titulo}</h1>
          {descripcion && <p className={estilos.descripcion}>{descripcion}</p>}
        </div>
        {acciones && <div className={estilos.acciones}>{acciones}</div>}
      </div>
      {children}
    </div>
  );
}
