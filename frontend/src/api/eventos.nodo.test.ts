// @vitest-environment node
//
// Pruebas del cliente WebSocket contra un servidor falso REAL (paquete `ws`): se abre un puerto
// local que se comporta como el motor (valida el token al conectar y saluda con `hola`).
// Los archivos *.nodo.test.ts corren en Node, sin navegador simulado.
import type { IncomingMessage } from 'node:http';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { ClienteEventos, type EstadoEnlace, type InfoEnlace } from './eventos';

const TOKEN = 'token-bueno';

const HOLA = {
  version: '0.1.0',
  estado: { modo: 'cursor', pausado: false, calibrado: true },
  ajustes: null,
};

function sobre(tipo: string, datos: object, seq = 1): string {
  return JSON.stringify({ v: 1, tipo, seq, t: 1763300000000 + seq, datos });
}

/** Imita al motor: rechaza la conexión si el token no vale y saluda con `hola`. */
class ServidorFalso {
  private servidor!: WebSocketServer;
  conexiones = 0;
  rechazos = 0;

  async arrancar(puerto = 0): Promise<this> {
    this.servidor = new WebSocketServer({
      host: '127.0.0.1',
      port: puerto,
      verifyClient: ({ req }: { req: IncomingMessage }) => {
        const valido = new URL(req.url ?? '', 'http://x').searchParams.get('token') === TOKEN;
        if (!valido) this.rechazos += 1;
        return valido;
      },
    });
    this.servidor.on('connection', (socket) => {
      this.conexiones += 1;
      socket.send(sobre('hola', HOLA));
    });
    await new Promise<void>((listo) => this.servidor.once('listening', listo));
    return this;
  }

  get puerto(): number {
    const direccion = this.servidor.address();
    if (direccion === null || typeof direccion === 'string') throw new Error('Servidor sin puerto');
    return direccion.port;
  }

  url(token = TOKEN): string {
    return `ws://127.0.0.1:${this.puerto}/api/v1/eventos?token=${token}`;
  }

  enviar(texto: string): void {
    for (const socket of this.servidor.clients) socket.send(texto);
  }

  /** Corta las conexiones abiertas (como si el motor se colgara) sin dejar de escuchar. */
  cortar(): void {
    for (const socket of this.servidor.clients) socket.terminate();
  }

  async detener(): Promise<void> {
    this.cortar();
    await new Promise<void>((listo) => this.servidor.close(() => listo()));
  }
}

const abiertos: { servidores: ServidorFalso[]; clientes: ClienteEventos[] } = {
  servidores: [],
  clientes: [],
};

async function servidorNuevo(): Promise<ServidorFalso> {
  const servidor = await new ServidorFalso().arrancar();
  abiertos.servidores.push(servidor);
  return servidor;
}

function clienteNuevo(opciones: ConstructorParameters<typeof ClienteEventos>[0]) {
  const cliente = new ClienteEventos({ esperaInicialMs: 20, esperaMaximaMs: 80, ...opciones });
  abiertos.clientes.push(cliente);
  const estados: EstadoEnlace[] = [];
  cliente.enEnlace((info) => {
    if (estados.at(-1) !== info.estado) estados.push(info.estado);
  });
  return { cliente, estados };
}

const hasta = (condicion: () => void) => vi.waitFor(condicion, { timeout: 3000, interval: 10 });

afterEach(async () => {
  vi.useRealTimers();
  abiertos.clientes.splice(0).forEach((cliente) => cliente.cerrar());
  await Promise.all(abiertos.servidores.splice(0).map((s) => s.detener().catch(() => undefined)));
});

describe('conexión', () => {
  test('se conecta con el token y queda abierto al recibir hola', async () => {
    const servidor = await servidorNuevo();
    const { cliente, estados } = clienteNuevo({ url: () => servidor.url() });
    const holas: unknown[] = [];
    cliente.en('hola', (datos) => holas.push(datos));

    expect(cliente.enlace.estado).toBe('inactivo');
    cliente.conectar();

    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));
    expect(estados).toEqual(['inactivo', 'conectando', 'abierto']);
    expect(holas).toEqual([HOLA]);
    expect(servidor.conexiones).toBe(1);
  });

  test('llamar a conectar dos veces no abre dos conexiones', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });

    cliente.conectar();
    cliente.conectar();

    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));
    expect(servidor.conexiones).toBe(1);
  });

  test('sin token no intenta conectar', () => {
    const crearSocket = vi.fn();
    const { cliente } = clienteNuevo({ url: () => null, crearSocket });

    cliente.conectar();

    expect(cliente.enlace.estado).toBe('no_autorizado');
    expect(crearSocket).not.toHaveBeenCalled();
  });
});

describe('eventos', () => {
  test('entrega cada evento a los oyentes de su tipo, con su sobre', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });
    const gestos: unknown[] = [];
    const modos: unknown[] = [];
    const tipos: string[] = [];
    cliente.en('gesto', (datos, envoltorio) => gestos.push([datos, envoltorio.seq]));
    cliente.en('modo', (datos) => modos.push(datos));
    cliente.enTodos((envoltorio) => tipos.push(envoltorio.tipo));
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    const gesto = { gesto: 'clench', zona: 'inferior', potencia: 0.82 };
    servidor.enviar(sobre('gesto', gesto, 2));

    await hasta(() => expect(gestos).toEqual([[gesto, 2]]));
    expect(modos).toEqual([]);
    expect(tipos).toEqual(['hola', 'gesto']);
  });

  test('dejar de escuchar corta la entrega', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });
    const recibidos: unknown[] = [];
    const tipos: string[] = [];
    const dejar = cliente.en('entrada', (datos) => recibidos.push(datos));
    cliente.enTodos((envoltorio) => tipos.push(envoltorio.tipo));
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    servidor.enviar(sobre('entrada', { accion: 'seleccionar' }, 2));
    await hasta(() => expect(recibidos).toHaveLength(1));
    dejar();
    servidor.enviar(sobre('entrada', { accion: 'atras' }, 3));
    servidor.enviar(sobre('modo', { modo: 'pausa' }, 4));

    // El segundo `entrada` llegó al cliente, pero ya no al oyente que se dio de baja.
    await hasta(() => expect(tipos).toEqual(['hola', 'entrada', 'entrada', 'modo']));
    expect(recibidos).toEqual([{ accion: 'seleccionar' }]);
  });

  test('ignora mensajes mal formados y tipos que no conoce', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });
    const tipos: string[] = [];
    cliente.enTodos((envoltorio) => tipos.push(envoltorio.tipo));
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    servidor.enviar('esto no es JSON');
    servidor.enviar(JSON.stringify({ v: 2, tipo: 'gesto', seq: 2, t: 0, datos: {} }));
    servidor.enviar(JSON.stringify({ v: 1, tipo: 'gesto', seq: 3, t: 0 }));
    servidor.enviar(JSON.stringify(['lista']));
    servidor.enviar(sobre('evento_del_futuro', { algo: 1 }, 4)); // contrato: lo nuevo se ignora
    servidor.enviar(sobre('modo', { modo: 'pausa' }, 5));

    await hasta(() => expect(tipos).toContain('modo'));
    expect(tipos).toEqual(['hola', 'evento_del_futuro', 'modo']);
    expect(cliente.enlace.estado).toBe('abierto');
  });

  test('un oyente que falla no deja sin evento a los demás', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recibidos: unknown[] = [];
    cliente.en('gesto', () => {
      throw new Error('oyente roto');
    });
    cliente.en('gesto', (datos) => recibidos.push(datos));
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    servidor.enviar(sobre('gesto', { gesto: 'winkL' }, 2));

    await hasta(() => expect(recibidos).toEqual([{ gesto: 'winkL' }]));
    expect(consola).toHaveBeenCalledOnce();
  });
});

describe('reconexión', () => {
  test('si se corta la conexión, reconecta sola y vuelve a recibir hola', async () => {
    const servidor = await servidorNuevo();
    const { cliente, estados } = clienteNuevo({ url: () => servidor.url() });
    let holas = 0;
    cliente.en('hola', () => (holas += 1));
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    servidor.cortar();

    await hasta(() => expect(holas).toBe(2));
    expect(estados).toEqual(['inactivo', 'conectando', 'abierto', 'reconectando', 'abierto']);
    expect(cliente.enlace).toEqual({ estado: 'abierto', intentos: 0, esperaMs: null });
  });

  test('si el motor se cae, sigue reintentando hasta que vuelve', async () => {
    const servidor = await servidorNuevo();
    const puerto = servidor.puerto;
    const url = servidor.url();
    const { cliente } = clienteNuevo({ url: () => url });
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    await servidor.detener();
    await hasta(() => expect(cliente.enlace.intentos).toBeGreaterThanOrEqual(2));
    expect(cliente.enlace.estado).toBe('reconectando');

    abiertos.servidores.push(await new ServidorFalso().arrancar(puerto));
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));
  });

  test('con un token incorrecto deja de reintentar', async () => {
    const servidor = await servidorNuevo();
    const debeReintentar = vi.fn(async () => false); // "el motor respondió 401"
    const crearSocket = vi.fn((url: string) => new WebSocket(url));
    const { cliente, estados } = clienteNuevo({
      url: () => servidor.url('token-malo'),
      debeReintentar,
      crearSocket,
    });

    cliente.conectar();

    await hasta(() => expect(cliente.enlace.estado).toBe('no_autorizado'));
    await new Promise((listo) => setTimeout(listo, 150)); // varias esperas de reintento
    expect(crearSocket).toHaveBeenCalledOnce();
    expect(servidor.rechazos).toBeGreaterThanOrEqual(1);
    expect(servidor.conexiones).toBe(0);
    expect(debeReintentar).toHaveBeenCalledOnce();
    expect(estados).toEqual(['inactivo', 'conectando', 'reconectando', 'no_autorizado']);
  });

  test('cerrar() corta la conexión y no reintenta', async () => {
    const servidor = await servidorNuevo();
    const { cliente } = clienteNuevo({ url: () => servidor.url() });
    cliente.conectar();
    await hasta(() => expect(cliente.enlace.estado).toBe('abierto'));

    cliente.cerrar();
    await new Promise((listo) => setTimeout(listo, 150));

    expect(cliente.enlace.estado).toBe('inactivo');
    expect(servidor.conexiones).toBe(1);
  });
});

describe('esperas entre reintentos (con sockets simulados)', () => {
  /** Socket que nunca conecta: falla en cuanto se crea, como cuando el motor está apagado. */
  class SocketCaido {
    onmessage: ((mensaje: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: ((cierre: CloseEvent) => void) | null = null;
    constructor(codigo: number) {
      queueMicrotask(() => this.onclose?.({ code: codigo } as CloseEvent));
    }
    close(): void {}
  }
  const fabrica = (codigo: number) =>
    vi.fn((_url: string) => new SocketCaido(codigo) as unknown as WebSocket);

  test('la espera se duplica en cada fallo hasta el máximo', async () => {
    vi.useFakeTimers();
    const crearSocket = fabrica(1006);
    const cliente = new ClienteEventos({
      url: () => 'ws://motor/api/v1/eventos?token=x',
      crearSocket,
      esperaInicialMs: 500,
      esperaMaximaMs: 8000,
    });
    const esperas: number[] = [];
    cliente.enEnlace((info: InfoEnlace) => {
      if (info.esperaMs !== null) esperas.push(info.esperaMs);
    });

    cliente.conectar();
    for (let i = 0; i < 7; i += 1) {
      await vi.advanceTimersByTimeAsync(8000);
    }
    cliente.cerrar();

    expect(esperas.slice(0, 7)).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
    expect(crearSocket.mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  test('reintentarAhora() no espera al temporizador', async () => {
    vi.useFakeTimers();
    const crearSocket = fabrica(1006);
    const cliente = new ClienteEventos({
      url: () => 'ws://motor/api/v1/eventos?token=x',
      crearSocket,
      esperaInicialMs: 60_000,
      esperaMaximaMs: 60_000,
    });
    cliente.conectar();
    await vi.advanceTimersByTimeAsync(0);
    expect(crearSocket).toHaveBeenCalledTimes(1);
    expect(cliente.enlace).toEqual({ estado: 'reconectando', intentos: 1, esperaMs: 60_000 });

    cliente.reintentarAhora();

    expect(crearSocket).toHaveBeenCalledTimes(2);
    cliente.cerrar();
  });

  test('un cierre 1008 (política) significa token no válido: no reintenta', async () => {
    vi.useFakeTimers();
    const crearSocket = fabrica(1008);
    const cliente = new ClienteEventos({ url: () => 'ws://motor/x', crearSocket });

    cliente.conectar();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(cliente.enlace.estado).toBe('no_autorizado');
    expect(crearSocket).toHaveBeenCalledTimes(1);
  });
});
