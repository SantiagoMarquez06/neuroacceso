// Órdenes al motor que deben llegar en el mismo orden en que se pidieron.
import { api } from '../api/rest';
import type { ModoPedible } from '../api/tipos';

let cola: Promise<unknown> = Promise.resolve();

/**
 * Pide un modo al motor. Las peticiones se encadenan: si una pantalla pide "comunicador" al
 * entrar y "cursor" al salir muy seguido, el motor las recibe en ese orden. El cambio real se
 * conoce por el evento `modo` (el modo lo decide el motor).
 */
export function pedirModo(modo: ModoPedible): Promise<void> {
  const orden = cola.then(() => api.cambiarModo(modo)).then(() => undefined);
  cola = orden.catch(() => undefined);
  return orden;
}
