// Manejadores MSW: conectan el motor falso a `fetch` y al WebSocket, con las mismas rutas y
// respuestas que la API v1 (contrato/api-v1.md).
import { http, HttpResponse, type HttpResponseResolver } from 'msw/http';
import { ws } from 'msw/ws';
import type {
  Ajustes,
  DatosEvento,
  Enunciado,
  Intento,
  PerfilCrear,
  PerfilEditar,
  TipoEvento,
} from '../api/tipos';
import { ErrorMotorFalso, type MotorFalso } from './motorFalso';

const API = '*/api/v1';

const json = (cuerpo: unknown, status = 200) => HttpResponse.json(cuerpo as never, { status });
const vacio = (status: 202 | 204) => new HttpResponse(null, { status });

/** Convierte los errores del motor falso en la respuesta `{ codigo, mensaje }` del contrato. */
function ruta(resolver: HttpResponseResolver): HttpResponseResolver {
  return async (info) => {
    try {
      return await resolver(info);
    } catch (error) {
      if (error instanceof ErrorMotorFalso) {
        return json({ codigo: error.codigo, mensaje: error.message }, error.status);
      }
      throw error;
    }
  };
}

const texto = (valor: string | readonly string[] | undefined) => String(valor);

export function crearManejadores(motor: MotorFalso) {
  // ---- WebSocket: /api/v1/eventos ------------------------------------------------------------
  const eventos = ws.link(/\/api\/v1\/eventos(\?.*)?$/);
  const secuencias = new Map<string, number>(); // `seq` crece de uno en uno por conexión

  const sobre = <K extends TipoEvento>(clienteId: string, tipo: K, datos: DatosEvento[K]) => {
    const seq = (secuencias.get(clienteId) ?? 0) + 1;
    secuencias.set(clienteId, seq);
    return JSON.stringify({ v: 1, tipo, seq, t: Date.now(), datos });
  };

  motor.emitir = (tipo, datos) => {
    for (const cliente of eventos.clients) cliente.send(sobre(cliente.id, tipo, datos));
  };

  const conexion = eventos.addEventListener('connection', ({ client }) => {
    client.send(sobre(client.id, 'hola', motor.hola()));
    if (motor.estado.conexion.estado === 'conectado') {
      client.send(sobre(client.id, 'dispositivo', motor.dispositivo()));
    }
    client.addEventListener('close', () => {
      secuencias.delete(client.id);
      // El cliente que se cierra aún puede figurar en la lista durante este evento.
      const quedan = [...eventos.clients].filter((otro) => otro.id !== client.id).length;
      if (quedan === 0) motor.interfazDesconectada();
    });
  });

  // ---- REST ----------------------------------------------------------------------------------
  return [
    conexion,

    http.get(`${API}/salud`, () => json(motor.salud())),
    http.get(`${API}/estado`, () => json(motor.estado)),

    http.post(`${API}/conexion`, () => {
      motor.conectar();
      return vacio(202);
    }),
    http.delete(`${API}/conexion`, () => {
      motor.desconectar();
      return vacio(204);
    }),

    http.put(
      `${API}/modo`,
      ruta(async ({ request }) => {
        const { modo } = (await request.json()) as { modo: 'cursor' | 'comunicador' | 'pausa' };
        return json(motor.cambiarModo(modo));
      }),
    ),

    http.post(
      `${API}/calibracion`,
      ruta(() => {
        motor.calibrar();
        return vacio(202);
      }),
    ),
    http.delete(`${API}/calibracion`, () => {
      motor.cancelarCalibracion();
      return vacio(204);
    }),

    http.get(`${API}/gestos/disponibles`, () => json(motor.gestosDisponibles())),

    // Perfiles
    http.get(`${API}/perfiles`, () => json(motor.listarPerfiles())),
    http.post(
      `${API}/perfiles`,
      ruta(async ({ request }) =>
        json(motor.crearPerfil((await request.json()) as PerfilCrear), 201),
      ),
    ),
    http.get(
      `${API}/perfiles/:id`,
      ruta(({ params }) => json(motor.obtenerPerfil(texto(params['id'])))),
    ),
    http.patch(
      `${API}/perfiles/:id`,
      ruta(async ({ params, request }) =>
        json(motor.editarPerfil(texto(params['id']), (await request.json()) as PerfilEditar)),
      ),
    ),
    http.delete(
      `${API}/perfiles/:id`,
      ruta(({ params }) => {
        motor.eliminarPerfil(texto(params['id']));
        return vacio(204);
      }),
    ),
    http.post(
      `${API}/perfiles/:id/activar`,
      ruta(({ params }) => json(motor.activarPerfil(texto(params['id'])))),
    ),
    http.get(
      `${API}/perfiles/:id/ajustes`,
      ruta(({ params }) => json(motor.obtenerAjustes(texto(params['id'])))),
    ),
    http.put(
      `${API}/perfiles/:id/ajustes`,
      ruta(async ({ params, request }) =>
        json(motor.guardarAjustes(texto(params['id']), (await request.json()) as Ajustes)),
      ),
    ),

    // Sesiones (exportar.csv va antes de :id para que no se confunda con un identificador)
    http.get(`${API}/sesiones/exportar.csv`, ({ request }) => {
      const perfilId = new URL(request.url).searchParams.get('perfil_id') ?? undefined;
      return new HttpResponse(motor.exportarCsv(perfilId), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }),
    http.post(
      `${API}/sesiones`,
      ruta(async ({ request }) => {
        const { tipo } = (await request.json()) as { tipo: 'libre' | 'practica' | 'comunicador' };
        return json(motor.crearSesion(tipo), 201);
      }),
    ),
    http.get(`${API}/sesiones`, ({ request }) => {
      const q = new URL(request.url).searchParams;
      return json(
        motor.listarSesiones({
          perfil_id: q.get('perfil_id') ?? undefined,
          desde: q.get('desde') ?? undefined,
          hasta: q.get('hasta') ?? undefined,
        }),
      );
    }),
    http.get(
      `${API}/sesiones/:id`,
      ruta(({ params }) => json(motor.obtenerSesion(texto(params['id'])))),
    ),
    http.post(
      `${API}/sesiones/:id/intentos`,
      ruta(async ({ params, request }) => {
        motor.agregarIntentos(texto(params['id']), (await request.json()) as Intento[]);
        return vacio(204);
      }),
    ),
    http.post(
      `${API}/sesiones/:id/enunciados`,
      ruta(async ({ params, request }) => {
        motor.agregarEnunciado(texto(params['id']), (await request.json()) as Enunciado);
        return vacio(204);
      }),
    ),
    http.post(
      `${API}/sesiones/:id/finalizar`,
      ruta(({ params }) => json(motor.finalizarSesion(texto(params['id'])))),
    ),

    // Entrenamiento
    http.post(
      `${API}/entrenamiento`,
      ruta(async ({ request }) => {
        const { deteccion, accion } = (await request.json()) as {
          deteccion: 'mental' | 'facial';
          accion: string;
        };
        return json(motor.iniciarEntrenamiento(deteccion, accion), 202);
      }),
    ),
    http.post(
      `${API}/entrenamiento/:id/aceptar`,
      ruta(() => {
        motor.responderEntrenamiento(true);
        return vacio(204);
      }),
    ),
    http.post(
      `${API}/entrenamiento/:id/rechazar`,
      ruta(() => {
        motor.responderEntrenamiento(false);
        return vacio(204);
      }),
    ),

    // Voz de respaldo
    http.post(`${API}/voz/hablar`, async ({ request }) => {
      motor.hablar(((await request.json()) as { texto: string }).texto);
      return vacio(202);
    }),

    // Simulación (solo existe con el motor en --demo)
    http.post(
      `${API}/dev/simular/gesto`,
      ruta(async ({ request }) => {
        motor.simularGesto(((await request.json()) as { gesto: string }).gesto);
        return vacio(204);
      }),
    ),
    http.post(`${API}/dev/simular/cabeza`, async ({ request }) => {
      const { yaw, pitch } = (await request.json()) as { yaw: number; pitch: number };
      motor.simularCabeza(yaw, pitch);
      return vacio(204);
    }),
    http.post(`${API}/dev/simular/contacto`, async ({ request }) => {
      motor.simularContacto(((await request.json()) as { malo: boolean }).malo);
      return vacio(204);
    }),
  ];
}
