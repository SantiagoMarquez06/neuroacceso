import { beforeEach, describe, expect, test } from 'vitest';
import ejemploAccion from '@contrato/ejemplos/ws/accion.json';
import ejemploAjustes from '@contrato/ejemplos/ws/ajustes.json';
import ejemploCalibracion from '@contrato/ejemplos/ws/calibracion.json';
import ejemploConexion from '@contrato/ejemplos/ws/conexion.json';
import ejemploDispositivo from '@contrato/ejemplos/ws/dispositivo.json';
import ejemploEntrada from '@contrato/ejemplos/ws/entrada.json';
import ejemploEntrenamiento from '@contrato/ejemplos/ws/entrenamiento.json';
import ejemploError from '@contrato/ejemplos/ws/error.json';
import ejemploGesto from '@contrato/ejemplos/ws/gesto.json';
import ejemploHola from '@contrato/ejemplos/ws/hola.json';
import ejemploModo from '@contrato/ejemplos/ws/modo.json';
import ejemploOrientacion from '@contrato/ejemplos/ws/orientacion.json';
import type { Evento } from '../api/tipos';
import { escuchar, recibir } from './conexion';
import {
  ESTADO_INICIAL,
  MAX_REGISTRO,
  reducir,
  reiniciarMotor,
  useMotor,
  type EstadoMotor,
} from './motor';
import { orientacion } from './orientacion';

// Los ejemplos del contrato son la fuente común: si el motor cambia un evento, esto lo nota.
const ev = (ejemplo: unknown) => ejemplo as Evento;
const hola = ev(ejemploHola);

function tras(...eventos: Evento[]): EstadoMotor {
  return eventos.reduce(reducir, ESTADO_INICIAL);
}

function evento<K extends Evento['tipo']>(
  tipo: K,
  datos: Extract<Evento, { tipo: K }>['datos'],
  t = 1_763_300_000_000,
): Evento {
  return { v: 1, tipo, seq: 1, t, datos } as Evento;
}

beforeEach(() => reiniciarMotor());

describe('reducir', () => {
  test('hola fija el estado completo, los ajustes y la versión', () => {
    const s = tras(hola);

    expect(s.version).toBe('0.1.0');
    expect(s.estado?.modo).toBe('cursor');
    expect(s.estado?.conexion).toEqual({
      estado: 'conectado',
      casco_id: 'EPOCX-SIMULADO',
      detalle: null,
    });
    expect(s.ajustes?.comunicador.frases).toContain('Tengo sed');
  });

  test('antes de hola, los cambios parciales de estado se ignoran', () => {
    expect(tras(ev(ejemploModo)).estado).toBeNull();
    expect(tras(ev(ejemploConexion)).estado).toBeNull();
  });

  test('dispositivo guarda batería y contacto', () => {
    const s = tras(hola, ev(ejemploDispositivo));

    expect(s.dispositivo?.bateria_pct).toBe(82);
    expect(s.dispositivo?.contacto['T7']).toBe(4);
  });

  test('un error de conexión guarda su código y borra los datos del casco', () => {
    const s = tras(
      hola,
      ev(ejemploDispositivo),
      evento('conexion', { estado: 'error', casco_id: null, detalle: 'x', codigo: 'SIN_CASCO' }),
    );

    expect(s.estado?.conexion.estado).toBe('error');
    expect(s.codigoConexion).toBe('SIN_CASCO');
    expect(s.dispositivo).toBeNull();
    expect(s.registro[0]).toMatchObject({ texto: 'Sin conexión con el casco', tono: 'mal' });
  });

  test('al reconectar se limpia el código de error', () => {
    const s = tras(
      hola,
      evento('conexion', { estado: 'error', casco_id: null, detalle: null, codigo: 'SIN_CASCO' }),
      ev(ejemploConexion),
    );

    expect(s.codigoConexion).toBeNull();
    expect(s.estado?.conexion.estado).toBe('conectado');
  });

  test('modo actualiza modo y pausa, y lo anota', () => {
    const s = tras(hola, evento('modo', { modo: 'pausa', pausado: true, motivo: 'usuario' }));

    expect(s.estado).toMatchObject({ modo: 'pausa', pausado: true });
    expect(s.registro[0]).toMatchObject({ texto: 'Modo: En pausa (lo pediste tú)', tono: 'aviso' });
  });

  test('una calibración completada marca el estado como calibrado', () => {
    const sinCalibrar = evento('hola', {
      ...(hola.datos as Extract<Evento, { tipo: 'hola' }>['datos']),
      estado: {
        ...(hola as Extract<Evento, { tipo: 'hola' }>).datos.estado,
        calibrado: false,
        modo: 'calibrando',
      },
    });
    const enCurso = tras(sinCalibrar, ev(ejemploCalibracion));
    expect(enCurso.calibracion?.progreso).toBe(0.4);
    expect(enCurso.estado?.calibrado).toBe(false);
    expect(enCurso.registro).toHaveLength(0); // el progreso no llena el registro

    const completa = reducir(
      enCurso,
      evento('calibracion', {
        estado: 'completada',
        progreso: 1,
        instruccion: 'Calibración completada',
      }),
    );
    expect(completa.estado?.calibrado).toBe(true);
    expect(completa.registro[0]).toMatchObject({ texto: 'Calibración completada', tono: 'bien' });
  });

  test('ajustes reemplaza los ajustes y sigue al perfil activo', () => {
    const otros = structuredClone(ejemploAjustes) as Extract<Evento, { tipo: 'ajustes' }>;
    otros.datos.perfil_id = 'p-2';
    otros.datos.ajustes.cursor.ganancia_x = 60;

    const s = tras(hola, otros);

    expect(s.ajustes?.cursor.ganancia_x).toBe(60);
    expect(s.estado?.perfil_activo_id).toBe('p-2');
  });

  test('si se borra el perfil activo, el motor envía perfil_id vacío', () => {
    const sinPerfil = structuredClone(ejemploAjustes) as Extract<Evento, { tipo: 'ajustes' }>;
    sinPerfil.datos.perfil_id = '';

    expect(tras(hola, sinPerfil).estado?.perfil_activo_id).toBeNull();
  });

  test('error y entrenamiento quedan disponibles para la pantalla', () => {
    const s = tras(hola, ev(ejemploError), ev(ejemploEntrenamiento));

    expect(s.error).toMatchObject({ codigo: 'CASCO_DESCONECTADO', recuperable: true });
    expect(s.entrenamiento).toEqual({ fase: 'exito', deteccion: 'mental', accion: 'push' });
  });

  test('al salir del modo entrenando se olvida el entrenamiento', () => {
    const s = tras(
      hola,
      ev(ejemploEntrenamiento),
      evento('modo', { modo: 'cursor', pausado: false, motivo: 'entrenamiento' }),
    );

    expect(s.entrenamiento).toBeNull();
  });

  test('orientacion y entrada no cambian este almacén', () => {
    const base = tras(hola);

    expect(reducir(base, ev(ejemploOrientacion))).toBe(base);
    expect(reducir(base, ev(ejemploEntrada))).toBe(base);
  });

  test('un tipo de evento desconocido se ignora', () => {
    const base = tras(hola);
    const futuro = { v: 1, tipo: 'algo_nuevo', seq: 9, t: 0, datos: {} } as unknown as Evento;

    expect(reducir(base, futuro)).toBe(base);
  });
});

describe('registro de eventos', () => {
  test('un gesto sin acción queda anotado como tal', () => {
    const s = tras(hola, evento('gesto', { gesto: 'blink', zona: 'ojos', potencia: 1 }));

    expect(s.gesto?.gesto).toBe('blink');
    expect(s.registro[0]?.texto).toBe('Parpadeo (sin acción)');
  });

  test('la acción que sigue a su gesto completa la misma línea', () => {
    const s = tras(hola, ev(ejemploGesto), ev(ejemploAccion));

    expect(s.registro).toHaveLength(1);
    expect(s.registro[0]).toMatchObject({ texto: 'Apretar la mandíbula → Clic', tono: 'bien' });
    expect(s.accion?.accion).toBe('clic');
  });

  test('una acción no ejecutada explica el motivo', () => {
    const s = tras(
      hola,
      evento('accion', {
        accion: 'clic',
        origen: { tipo: 'gesto', nombre: 'clench' },
        modo: 'pausa',
        ejecutada: false,
        motivo: 'pausado',
      }),
    );

    expect(s.registro[0]).toMatchObject({
      texto: 'Apretar la mandíbula: no se hizo «Clic» porque el cursor está en pausa',
      tono: 'aviso',
    });
  });

  test('una acción de otro origen (permanencia) va en su propia línea', () => {
    const s = tras(
      hola,
      ev(ejemploGesto),
      evento('accion', {
        accion: 'clic',
        origen: { tipo: 'dwell', nombre: 'permanencia' },
        modo: 'cursor',
        ejecutada: true,
        motivo: null,
      }),
    );

    expect(s.registro.map((r) => r.texto)).toEqual([
      'Quedarse quieto → Clic',
      'Apretar la mandíbula (sin acción)',
    ]);
  });

  test('guarda como máximo los últimos 100, el más reciente primero', () => {
    const muchos = Array.from({ length: MAX_REGISTRO + 30 }, (_, i) =>
      evento('gesto', { gesto: i % 2 ? 'winkL' : 'winkR', zona: 'ojos', potencia: 1 }, 1000 + i),
    );

    const s = tras(hola, ...muchos);

    expect(s.registro).toHaveLength(MAX_REGISTRO);
    expect(s.registro[0]?.t).toBe(1000 + MAX_REGISTRO + 29);
    expect(new Set(s.registro.map((r) => r.id)).size).toBe(MAX_REGISTRO);
  });
});

describe('recibir', () => {
  test('actualiza el almacén y avisa a quien escucha ese tipo', () => {
    const entradas: string[] = [];
    const dejar = escuchar('entrada', (datos) => entradas.push(datos.accion));

    recibir(hola);
    recibir(ev(ejemploEntrada));
    dejar();
    recibir(ev(ejemploEntrada));

    expect(useMotor.getState().estado?.modo).toBe('cursor');
    expect(entradas).toEqual(['seleccionar']);
  });

  test('la orientación va a su propio almacén, sin tocar el principal', () => {
    recibir(hola);
    const antes = useMotor.getState();
    const vistas: number[] = [];
    const dejar = orientacion.suscribir((o) => vistas.push(o.yaw));

    recibir(ev(ejemploOrientacion));
    dejar();

    expect(orientacion.leer()).toEqual({ yaw: -3.5, pitch: 1.2, calibrado: true });
    expect(vistas).toEqual([-3.5]);
    expect(useMotor.getState()).toBe(antes);
  });
});
