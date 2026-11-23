import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { BotonGrande, ErrorPantalla } from '../componentes';
import estilos from './ErrorDeRuta.module.css';

/**
 * Red de seguridad: si una pantalla falla al dibujarse, se muestra un mensaje claro con una
 * salida, en lugar de una ventana en blanco. El detalle técnico va a la consola.
 */
export function ErrorDeRuta() {
  const error = useRouteError();

  useEffect(() => {
    console.error('Error en una pantalla de NeuroAcceso', error);
  }, [error]);

  return (
    <main className={estilos.marco}>
      <ErrorPantalla error={error} />
      <div className={estilos.salidas}>
        <BotonGrande
          variante="principal"
          icono="reintentar"
          onClick={() => window.location.reload()}
        >
          Recargar
        </BotonGrande>
        <BotonGrande icono="inicio" onClick={() => window.location.assign('/estado')}>
          Ir al inicio
        </BotonGrande>
      </div>
    </main>
  );
}
