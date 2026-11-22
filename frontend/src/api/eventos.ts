// Cliente del WebSocket de eventos (servidor → cliente) con reconexión automática.
//
// Reglas del contrato que este cliente respeta:
//  - El token va en la URL (?token=…). Las órdenes no van por aquí: van por REST.
//  - Al conectar (o reconectar) llega `hola` con el estado completo; los eventos perdidos no se
//    reenvían, así que `hola` es siempre la fuente de verdad.
//  - La interfaz ignora lo que no conoce (tipos de evento nuevos, mensajes mal formados).
import type { DatosEvento, Evento, Sobre, TipoEvento } from './tipos';

export type EstadoEnlace =
  /** Aún no se pidió conectar, o se cerró a propósito. */
  | 'inactivo'
  /** Primer intento en curso. */
  | 'conectando'
  /** Conectado: ya llegó `hola`. */
  | 'abierto'
  /** Se perdió la conexión; hay un reintento en curso o programado. */
  | 'reconectando'
  /** El motor rechaza el token (o no hay token): reintentar no sirve. */
  | 'no_autorizado';

export interface InfoEnlace {
  estado: EstadoEnlace;
  /** Reintentos seguidos sin éxito. */
  intentos: number;
  /** Milisegundos hasta el próximo reintento, si hay uno programado. */
  esperaMs: number | null;
}

export interface OpcionesCliente {
  /** URL completa del WebSocket; se pide en cada intento. `null` = no hay token. */
  url: () => string | null;
  /** Espera antes del primer reintento; se duplica en cada fallo. */
  esperaInicialMs?: number;
  esperaMaximaMs?: number;
  /**
   * Se consulta cuando un intento falla sin haber llegado a conectar. Si devuelve `false`, el
   * cliente deja de reintentar y queda en `no_autorizado`. Sirve para distinguir "el motor no
   * está" (reintentar) de "el token no vale" (no reintentar): el navegador no dice por qué
   * falló la conexión de un WebSocket.
   */
  debeReintentar?: () => Promise<boolean>;
  /** Para pruebas: fábrica del socket. */
  crearSocket?: (url: string) => WebSocket;
}

type Oyente<K extends TipoEvento> = (datos: DatosEvento[K], sobre: Sobre<K>) => void;

const CIERRE_NORMAL = 1000;
const CIERRE_POLITICA = 1008; // el motor lo usa cuando el token o el origen no valen

function esSobre(valor: unknown): valor is Sobre {
  if (valor === null || typeof valor !== 'object') return false;
  const { v, tipo, datos } = valor as Record<string, unknown>;
  return v === 1 && typeof tipo === 'string' && datos !== null && typeof datos === 'object';
}

export class ClienteEventos {
  private readonly esperaInicialMs: number;
  private readonly esperaMaximaMs: number;
  private socket: WebSocket | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private activo = false;
  private info: InfoEnlace = { estado: 'inactivo', intentos: 0, esperaMs: null };

  private readonly porTipo = new Map<string, Set<Oyente<TipoEvento>>>();
  private readonly deTodos = new Set<(sobre: Evento) => void>();
  private readonly deEnlace = new Set<(info: InfoEnlace) => void>();

  constructor(private readonly opciones: OpcionesCliente) {
    this.esperaInicialMs = opciones.esperaInicialMs ?? 500;
    this.esperaMaximaMs = opciones.esperaMaximaMs ?? 8000;
  }

  get enlace(): InfoEnlace {
    return this.info;
  }

  /** Abre la conexión y la mantiene (reintenta sola si se cae). */
  conectar(): void {
    if (this.activo) return;
    this.activo = true;
    this.abrir(0);
  }

  /** Cierra la conexión y deja de reintentar. */
  cerrar(): void {
    this.activo = false;
    this.cancelarTemporizador();
    const socket = this.socket;
    this.socket = null;
    socket?.close(CIERRE_NORMAL);
    this.fijar({ estado: 'inactivo', intentos: 0, esperaMs: null });
  }

  /** Reintenta ya, sin esperar al temporizador (botón "Reintentar"). */
  reintentarAhora(): void {
    if (this.info.estado === 'abierto' || this.info.estado === 'conectando') return;
    this.activo = true;
    this.cancelarTemporizador();
    this.socket?.close(CIERRE_NORMAL);
    this.socket = null;
    this.abrir(0);
  }

  /** Escucha un tipo de evento. Devuelve la función para dejar de escuchar. */
  en<K extends TipoEvento>(tipo: K, oyente: Oyente<K>): () => void {
    const oyentes = this.porTipo.get(tipo) ?? new Set();
    this.porTipo.set(tipo, oyentes);
    oyentes.add(oyente as Oyente<TipoEvento>);
    return () => oyentes.delete(oyente as Oyente<TipoEvento>);
  }

  /** Escucha todos los eventos (los almacenes de estado y el panel de desarrollo). */
  enTodos(oyente: (sobre: Evento) => void): () => void {
    this.deTodos.add(oyente);
    return () => this.deTodos.delete(oyente);
  }

  /** Escucha los cambios del enlace; se llama enseguida con el estado actual. */
  enEnlace(oyente: (info: InfoEnlace) => void): () => void {
    this.deEnlace.add(oyente);
    oyente(this.info);
    return () => this.deEnlace.delete(oyente);
  }

  // ------------------------------------------------------------------------------------------

  private abrir(intentos: number): void {
    const url = this.opciones.url();
    if (url === null) {
      this.activo = false;
      this.fijar({ estado: 'no_autorizado', intentos, esperaMs: null });
      return;
    }
    this.fijar({
      estado: intentos === 0 ? 'conectando' : 'reconectando',
      intentos,
      esperaMs: null,
    });

    const socket = this.opciones.crearSocket?.(url) ?? new WebSocket(url);
    this.socket = socket;
    let huboSesion = false;

    socket.onmessage = (mensaje: MessageEvent) => {
      if (this.socket !== socket) return;
      const sobre = this.leer(mensaje.data);
      if (!sobre) return;
      if (sobre.tipo === 'hola') {
        huboSesion = true;
        this.fijar({ estado: 'abierto', intentos: 0, esperaMs: null });
      }
      this.repartir(sobre);
    };

    socket.onclose = (cierre: CloseEvent) => {
      if (this.socket !== socket) return; // lo cerramos nosotros o ya hay otro socket
      this.socket = null;
      if (!this.activo) return;
      if (cierre.code === CIERRE_POLITICA) {
        this.activo = false;
        this.fijar({ estado: 'no_autorizado', intentos, esperaMs: null });
        return;
      }
      void this.programar(huboSesion ? 0 : intentos, huboSesion);
    };

    socket.onerror = () => {
      // Tras un error siempre llega `close`; allí se decide el reintento.
    };
  }

  private async programar(intentos: number, huboSesion: boolean): Promise<void> {
    // Mientras se decide, la interfaz ya debe mostrar que no hay conexión.
    this.fijar({ estado: 'reconectando', intentos, esperaMs: null });
    if (!huboSesion && this.opciones.debeReintentar) {
      const seguir = await this.opciones.debeReintentar().catch(() => true);
      if (!this.activo) return;
      if (!seguir) {
        this.activo = false;
        this.fijar({ estado: 'no_autorizado', intentos, esperaMs: null });
        return;
      }
    }
    const esperaMs = Math.min(this.esperaInicialMs * 2 ** intentos, this.esperaMaximaMs);
    this.fijar({ estado: 'reconectando', intentos: intentos + 1, esperaMs });
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      if (this.activo) this.abrir(intentos + 1);
    }, esperaMs);
  }

  private leer(crudo: unknown): Sobre | null {
    if (typeof crudo !== 'string') return null;
    try {
      const valor: unknown = JSON.parse(crudo);
      return esSobre(valor) ? valor : null;
    } catch {
      return null;
    }
  }

  private repartir(sobre: Sobre): void {
    const avisar = (oyente: () => void) => {
      try {
        oyente();
      } catch (error) {
        // Un oyente roto no debe dejar sin eventos a los demás.
        console.error(`Error al procesar el evento "${sobre.tipo}"`, error);
      }
    };
    for (const oyente of this.deTodos) avisar(() => oyente(sobre as Evento));
    for (const oyente of this.porTipo.get(sobre.tipo) ?? []) {
      avisar(() => oyente(sobre.datos, sobre));
    }
  }

  private fijar(info: InfoEnlace): void {
    this.info = info;
    for (const oyente of this.deEnlace) oyente(info);
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}
