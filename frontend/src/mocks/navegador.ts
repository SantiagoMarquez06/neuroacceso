// `npm run dev:mock`: arranca la interfaz SIN backend. Un Service Worker (MSW) intercepta las
// peticiones a /api/v1 y el WebSocket de eventos, y responde un motor falso en memoria.
import { setupWorker } from 'msw/browser';
import { crearManejadores } from './manejadores';
import { MotorFalso } from './motorFalso';

export async function iniciarMocks(): Promise<MotorFalso> {
  const motor = new MotorFalso({ latidos: true, conHistorial: true });
  const trabajador = setupWorker(...crearManejadores(motor));
  await trabajador.start({
    onUnhandledFrame: 'bypass', // el resto (la propia app, fuentes…) sigue su camino normal
    quiet: true,
  });
  // A mano desde la consola del navegador: motorFalso.fallarConexion('SIN_CASCO', '…')
  Object.assign(window, { motorFalso: motor });
  console.info('[mock] Motor simulado en marcha: no hay backend. Panel de pruebas en /dev');
  return motor;
}
