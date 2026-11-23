import { Link } from 'react-router';
import { Vacio } from '../componentes';
import { Pantalla } from '../estructura/Pantalla';

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
