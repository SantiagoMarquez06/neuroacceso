// Utilidades para probar pantallas completas, con sus rutas y consultas reales.
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { crearClienteConsultas } from '../api/consultas';
import { App } from '../App';
import { rutas } from '../rutas';

/**
 * Dibuja la aplicación entera en una ruta. Antes hay que preparar el motor con
 * `usarMotorFalso()` (o dejar el almacén como convenga a la prueba).
 */
export function renderizarApp(ruta = '/estado') {
  const enrutador = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const consultas = crearClienteConsultas({ reintentos: false });
  const vista = render(<App enrutador={enrutador} consultas={consultas} />);
  return {
    ...vista,
    enrutador,
    consultas,
    usuario: userEvent.setup(),
    /** Ruta en la que está la aplicación ahora. */
    rutaActual: () => enrutador.state.location.pathname,
  };
}
