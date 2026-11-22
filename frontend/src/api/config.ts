// Dónde está el motor y con qué token se le habla.
//
// El motor genera un token en cada arranque y abre la interfaz con él en el fragmento de la URL
// (http://127.0.0.1:8765/#token=…). El fragmento nunca se envía al servidor ni queda en logs.

/** `npm run dev:mock`: no hay motor; MSW responde con los ejemplos del contrato. */
export const ES_MOCK = import.meta.env.MODE === 'mock';

const CLAVE_TOKEN = 'neuroacceso.token';
const TOKEN_MOCK = 'token-de-mentira';

/** Extrae el token de un fragmento como "#token=abc" o "#otra=1&token=abc". */
export function tokenDelFragmento(fragmento: string): string | null {
  const valor = new URLSearchParams(fragmento.replace(/^#/, '')).get('token');
  return valor ? valor : null;
}

/**
 * Token para hablar con el motor, o null si la interfaz se abrió sin él.
 * La primera vez lo toma del fragmento, lo guarda para esta ventana (sobrevive a recargas) y
 * limpia la URL para que no quede a la vista ni en el historial.
 */
export function obtenerToken(): string | null {
  if (ES_MOCK) return TOKEN_MOCK;
  const delFragmento = tokenDelFragmento(window.location.hash);
  if (delFragmento) {
    try {
      sessionStorage.setItem(CLAVE_TOKEN, delFragmento);
    } catch {
      return delFragmento; // sin almacenamiento: vale mientras no se recargue
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return delFragmento;
  }
}

/** Origen del motor. En producción es el mismo que sirve la interfaz. */
export function origenMotor(): string {
  const configurado = ES_MOCK ? '' : (import.meta.env.VITE_MOTOR_URL ?? '');
  return (configurado || window.location.origin).replace(/\/+$/, '');
}

export function urlRest(ruta: string): string {
  return `${origenMotor()}/api/v1${ruta}`;
}

export function urlEventos(token: string): string {
  const url = new URL(`${origenMotor()}/api/v1/eventos`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}
