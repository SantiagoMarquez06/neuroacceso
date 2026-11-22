import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, ErrorApi } from './rest';

const pedido = vi.fn<typeof fetch>();

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Última petición hecha, en forma cómoda de comprobar. */
function ultima() {
  const [url, opciones] = pedido.mock.lastCall ?? [];
  return {
    url: String(url),
    metodo: opciones?.method,
    cabeceras: opciones?.headers as Record<string, string>,
    cuerpo: typeof opciones?.body === 'string' ? (JSON.parse(opciones.body) as unknown) : undefined,
  };
}

beforeEach(() => {
  pedido.mockReset();
  vi.stubGlobal('fetch', pedido);
  sessionStorage.setItem('neuroacceso.token', 'abc123');
});

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('peticiones', () => {
  test('usa la base /api/v1 del motor y envía el token', async () => {
    pedido.mockResolvedValue(
      json({ version: '0.1.0', api_version: 1, fuente: 'simulador', demo: true }),
    );

    const salud = await api.salud();

    expect(salud.demo).toBe(true);
    expect(ultima().url).toBe(`${window.location.origin}/api/v1/salud`);
    expect(ultima().metodo).toBe('GET');
    expect(ultima().cabeceras).toEqual({ Authorization: 'Bearer abc123' });
  });

  test('envía el cuerpo como JSON', async () => {
    pedido.mockResolvedValue(json({ modo: 'comunicador', pausado: false }));

    await api.cambiarModo('comunicador');

    expect(ultima().metodo).toBe('PUT');
    expect(ultima().url).toMatch(/\/api\/v1\/modo$/);
    expect(ultima().cuerpo).toEqual({ modo: 'comunicador' });
    expect(ultima().cabeceras['Content-Type']).toBe('application/json');
  });

  test('las órdenes sin respuesta (202 / 204) no intentan leer JSON', async () => {
    pedido.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.perfiles.eliminar('p-1')).resolves.toBeUndefined();

    pedido.mockResolvedValue(new Response(null, { status: 202 }));
    await expect(api.calibrar()).resolves.toBeUndefined();
    expect(ultima().cuerpo).toEqual({ tipo: 'centro' });
  });

  test('codifica los identificadores en la ruta', async () => {
    pedido.mockResolvedValue(json({}));

    await api.perfiles.ajustes('p 1/x');

    expect(ultima().url).toMatch(/\/perfiles\/p%201%2Fx\/ajustes$/);
  });

  test('filtra las sesiones solo por los campos indicados', async () => {
    pedido.mockImplementation(async () => json([])); // una respuesta nueva por petición

    await api.sesiones.listar({ perfil_id: 'p-1', desde: '2026-12-01T00:00:00Z' });
    expect(ultima().url).toMatch(/\/sesiones\?perfil_id=p-1&desde=2026-12-01T00%3A00%3A00Z$/);

    await api.sesiones.listar();
    expect(ultima().url).toMatch(/\/sesiones$/);
  });

  test('envía los intentos de la práctica como lista', async () => {
    pedido.mockResolvedValue(new Response(null, { status: 204 }));
    const intento = {
      n: 0,
      t_inicio_ms: 0,
      t_fin_ms: 900,
      objetivo: { x: 300, y: 200, ancho: 80 },
      origen: { x: 100, y: 200 },
      clic: { x: 305, y: 198 },
      acierto: true,
      dpr: 1,
    };

    await api.sesiones.agregarIntentos('s-1', [intento]);

    expect(ultima().url).toMatch(/\/sesiones\/s-1\/intentos$/);
    expect(ultima().cuerpo).toEqual([intento]);
  });

  test('exporta el CSV como texto', async () => {
    pedido.mockResolvedValue(new Response('id,perfil\ns-1,Ana\n', { status: 200 }));

    await expect(api.sesiones.exportarCsv('p-1')).resolves.toBe('id,perfil\ns-1,Ana\n');
    expect(ultima().url).toMatch(/\/sesiones\/exportar\.csv\?perfil_id=p-1$/);
  });
});

describe('errores', () => {
  test('convierte el error del motor en ErrorApi con su código', async () => {
    pedido.mockResolvedValue(
      json({ codigo: 'PERFIL_NO_ENCONTRADO', mensaje: 'No existe el perfil p-9' }, 404),
    );

    const error = await api.perfiles.obtener('p-9').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({
      status: 404,
      codigo: 'PERFIL_NO_ENCONTRADO',
      message: 'No existe el perfil p-9',
    });
  });

  test('conserva el detalle de los errores de validación', async () => {
    const detalle = { errores: [{ loc: ['body', 'nombre'], msg: 'muy corto' }] };
    pedido.mockResolvedValue(
      json({ codigo: 'VALIDACION', mensaje: 'Datos no válidos', detalle }, 422),
    );

    const error = await api.perfiles.crear({ nombre: '' }).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'VALIDACION', detalle });
  });

  test('si la respuesta de error no es JSON, usa el código DESCONOCIDO', async () => {
    pedido.mockResolvedValue(new Response('<h1>500</h1>', { status: 500 }));

    const error = await api.estado().catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 500, codigo: 'DESCONOCIDO' });
  });

  test('si el motor no responde, el código es MOTOR_NO_DISPONIBLE', async () => {
    pedido.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await api.estado().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({ status: 0, codigo: 'MOTOR_NO_DISPONIBLE' });
  });

  test('sin token no envía la cabecera Authorization', async () => {
    sessionStorage.clear();
    pedido.mockResolvedValue(json({ codigo: 'NO_AUTORIZADO', mensaje: 'Token ausente' }, 401));

    const error = await api.estado().catch((e: unknown) => e);

    expect(ultima().cabeceras).toEqual({});
    expect(error).toMatchObject({ status: 401, codigo: 'NO_AUTORIZADO' });
  });
});
