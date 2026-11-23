// Para las pruebas de pantallas: conecta el motor falso directamente a la interfaz, sin red.
// Las llamadas de `api` van a sus métodos y sus eventos entran por `recibir`, igual que entrarían
// por el WebSocket.
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { api, ErrorApi } from '../api/rest';
import type { Evento, TipoEvento, DatosEvento } from '../api/tipos';
import { recibir } from '../estado/conexion';
import { fijarEnlace, reiniciarMotor } from '../estado/motor';
import { ErrorMotorFalso, MotorFalso, type OpcionesMotorFalso } from '../mocks/motorFalso';

let seq = 0;

/** Construye un evento como los que envía el motor. */
export function evento<K extends TipoEvento>(tipo: K, datos: DatosEvento[K]): Evento {
  return { v: 1, tipo, seq: ++seq, t: Date.now(), datos } as Evento;
}

/** Hace llegar un evento a la interfaz, dentro de `act` para que React se actualice. */
export function llega<K extends TipoEvento>(tipo: K, datos: DatosEvento[K]): void {
  act(() => recibir(evento(tipo, datos)));
}

/** Envuelve un método del motor falso como una llamada REST: asíncrona y con ErrorApi. */
function comoApi<A extends unknown[], R>(metodo: (...args: A) => R) {
  return async (...args: A): Promise<R> => {
    try {
      return metodo(...args);
    } catch (error) {
      if (error instanceof ErrorMotorFalso) {
        throw new ErrorApi(error.status, error.codigo, error.message);
      }
      throw error;
    }
  };
}

/**
 * Sustituye la API por un motor falso y deja la interfaz "conectada" (ya llegó `hola`).
 * Llamar en cada prueba (o en `beforeEach`); `vi.restoreAllMocks` deshace las sustituciones.
 */
export function usarMotorFalso(opciones: OpcionesMotorFalso = {}): MotorFalso {
  const motor = new MotorFalso(opciones);
  motor.emitir = (tipo, datos) => act(() => recibir(evento(tipo, datos)));

  const m = motor;
  vi.spyOn(api, 'salud').mockImplementation(comoApi(() => m.salud()));
  vi.spyOn(api, 'estado').mockImplementation(comoApi(() => structuredClone(m.estado)));
  vi.spyOn(api, 'conectar').mockImplementation(comoApi(() => m.conectar()));
  vi.spyOn(api, 'desconectar').mockImplementation(comoApi(() => m.desconectar()));
  vi.spyOn(api, 'cambiarModo').mockImplementation(comoApi((modo) => m.cambiarModo(modo)));
  vi.spyOn(api, 'calibrar').mockImplementation(comoApi(() => m.calibrar()));
  vi.spyOn(api, 'cancelarCalibracion').mockImplementation(comoApi(() => m.cancelarCalibracion()));
  vi.spyOn(api, 'gestosDisponibles').mockImplementation(comoApi(() => m.gestosDisponibles()));

  vi.spyOn(api.perfiles, 'listar').mockImplementation(comoApi(() => m.listarPerfiles()));
  vi.spyOn(api.perfiles, 'crear').mockImplementation(comoApi((d) => m.crearPerfil(d)));
  vi.spyOn(api.perfiles, 'obtener').mockImplementation(comoApi((id) => m.obtenerPerfil(id)));
  vi.spyOn(api.perfiles, 'editar').mockImplementation(comoApi((id, c) => m.editarPerfil(id, c)));
  vi.spyOn(api.perfiles, 'eliminar').mockImplementation(comoApi((id) => m.eliminarPerfil(id)));
  vi.spyOn(api.perfiles, 'activar').mockImplementation(comoApi((id) => m.activarPerfil(id)));
  vi.spyOn(api.perfiles, 'ajustes').mockImplementation(comoApi((id) => m.obtenerAjustes(id)));
  vi.spyOn(api.perfiles, 'guardarAjustes').mockImplementation(
    comoApi((id, a) => m.guardarAjustes(id, a)),
  );

  vi.spyOn(api.sesiones, 'crear').mockImplementation(comoApi((tipo) => m.crearSesion(tipo)));
  vi.spyOn(api.sesiones, 'finalizar').mockImplementation(comoApi((id) => m.finalizarSesion(id)));
  vi.spyOn(api.sesiones, 'listar').mockImplementation(comoApi((f) => m.listarSesiones(f)));
  vi.spyOn(api.sesiones, 'obtener').mockImplementation(comoApi((id) => m.obtenerSesion(id)));
  vi.spyOn(api.sesiones, 'agregarIntentos').mockImplementation(
    comoApi((id, i) => m.agregarIntentos(id, i)),
  );
  vi.spyOn(api.sesiones, 'agregarEnunciado').mockImplementation(
    comoApi((id, e) => m.agregarEnunciado(id, e)),
  );
  vi.spyOn(api.sesiones, 'exportarCsv').mockImplementation(comoApi((id) => m.exportarCsv(id)));

  vi.spyOn(api.entrenamiento, 'iniciar').mockImplementation(
    comoApi((d, a) => m.iniciarEntrenamiento(d, a)),
  );
  vi.spyOn(api.entrenamiento, 'aceptar').mockImplementation(
    comoApi(() => m.responderEntrenamiento(true)),
  );
  vi.spyOn(api.entrenamiento, 'rechazar').mockImplementation(
    comoApi(() => m.responderEntrenamiento(false)),
  );

  vi.spyOn(api.voz, 'hablar').mockImplementation(comoApi((texto) => m.hablar(texto)));

  vi.spyOn(api.dev, 'simularGesto').mockImplementation(comoApi((g) => m.simularGesto(g)));
  vi.spyOn(api.dev, 'simularCabeza').mockImplementation(comoApi((y, p) => m.simularCabeza(y, p)));
  vi.spyOn(api.dev, 'simularContacto').mockImplementation(comoApi((x) => m.simularContacto(x)));

  // La interfaz arranca como si el WebSocket acabara de abrirse.
  reiniciarMotor();
  fijarEnlace({ estado: 'abierto', intentos: 0, esperaMs: null });
  recibir(evento('hola', motor.hola()));
  if (motor.estado.conexion.estado === 'conectado') {
    recibir(evento('dispositivo', motor.dispositivo()));
  }
  return motor;
}
