import { Link } from 'react-router';
import { Vacio } from '../componentes';
import { Pantalla } from '../estructura/Pantalla';

/** Pantalla aún no construida: mantiene la navegación completa mientras se desarrolla. */
export function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <Pantalla titulo={titulo}>
      <Vacio icono="desarrollo" titulo="Esta pantalla está en construcción">
        <p>Llegará en una de las próximas fases del proyecto.</p>
      </Vacio>
    </Pantalla>
  );
}

export function NoEncontrada() {
  return (
    <Pantalla titulo="Esa pantalla no existe">
      <Vacio icono="alerta" titulo="No hay nada en esta dirección">
        <p>
          <Link to="/estado">Volver al inicio</Link>
        </p>
      </Vacio>
    </Pantalla>
  );
}
