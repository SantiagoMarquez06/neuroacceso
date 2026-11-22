import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Intento } from '../api/tipos';
import { calcularMetricas, throughput } from './metricas';
import { ErrorMotorFalso, MotorFalso } from './motorFalso';

type Emitido = [tipo: string, datos: Record<string, unknown>];

function motorCon(opciones: ConstructorParameters<typeof MotorFalso>[0] = {}) {
  const motor = new MotorFalso(opciones);
  const emitidos: Emitido[] = [];
  motor.emitir = (tipo, datos) => emitidos.push([tipo, datos as Record<string, unknown>]);
  const de = (tipo: string) => emitidos.filter(([t]) => t === tipo).map(([, datos]) => datos);
  return { motor, emitidos, de };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('arranque', () => {
  test('sembrado: casco conectado y calibrado, con Ana como perfil activo', () => {
    const { motor } = motorCon();

    expect(motor.hola().estado).toMatchObject({
      modo: 'cursor',
      calibrado: true,
      conexion: { estado: 'conectado', casco_id: 'EPOCX-SIMULADO' },
    });
    expect(motor.listarPerfiles().map((p) => p.nombre)).toEqual(['Ana', 'Pedro']);
    expect(motor.estado.perfil_activo_id).toBe(motor.perfiles[0]?.id);
  });

  test('sin sembrar: desconectado y sin perfiles, como un motor recién instalado', () => {
    const { motor } = motorCon({ sembrado: false });

    expect(motor.estado.modo).toBe('desconectado');
    expect(motor.listarPerfiles()).toEqual([]);
    expect(() => motor.crearSesion('practica')).toThrowError(ErrorMotorFalso);
  });

  test('conectar pasa por conectando → conectado y calibra solo', () => {
    const { motor, de } = motorCon({ sembrado: false, calibracionMs: 1000 });

    motor.conectar();
    expect(de('conexion').at(-1)).toMatchObject({ estado: 'conectando' });

    vi.advanceTimersByTime(300);
    expect(de('conexion').at(-1)).toMatchObject({ estado: 'conectado', codigo: null });
    expect(motor.estado.modo).toBe('calibrando');

    vi.advanceTimersByTime(1000);
    expect(de('calibracion').at(-1)).toMatchObject({ estado: 'completada', progreso: 1 });
    // No había un modo previo de usuario: tras calibrar queda en cursor.
    expect(motor.estado).toMatchObject({ modo: 'cursor', calibrado: true });
  });
});

describe('modos', () => {
  test('cambiar de modo emite el evento con el motivo', () => {
    const { motor, de } = motorCon();

    expect(motor.cambiarModo('comunicador')).toEqual({ modo: 'comunicador', pausado: false });
    expect(de('modo')).toEqual([{ modo: 'comunicador', pausado: false, motivo: 'usuario' }]);

    motor.cambiarModo('pausa');
    expect(motor.estado.pausado).toBe(true);
  });

  test('pedir el modo que ya está no emite nada', () => {
    const { motor, de } = motorCon();
    motor.cambiarModo('cursor');
    expect(de('modo')).toEqual([]);
  });

  test('no se puede cambiar de modo mientras calibra', () => {
    const { motor } = motorCon();
    motor.calibrar();

    expect(() => motor.cambiarModo('comunicador')).toThrowError(
      expect.objectContaining({ status: 409, codigo: 'MODO_INVALIDO' }),
    );
  });

  test('si se cierra la interfaz en el comunicador, vuelve a cursor', () => {
    const { motor, de } = motorCon();
    motor.cambiarModo('comunicador');

    motor.interfazDesconectada();

    expect(de('modo').at(-1)).toEqual({
      modo: 'cursor',
      pausado: false,
      motivo: 'ui_desconectada',
    });
  });
});

describe('calibración', () => {
  test('informa del progreso y vuelve al modo anterior', () => {
    const { motor, de } = motorCon({ calibracionMs: 1000 });
    motor.cambiarModo('pausa');

    motor.calibrar();
    vi.advanceTimersByTime(600);
    expect(de('calibracion').map((c) => c['progreso'])).toEqual([0, 0.2, 0.4, 0.6]);
    expect(motor.estado.modo).toBe('calibrando');

    vi.advanceTimersByTime(400);
    expect(motor.estado.modo).toBe('pausa');
  });

  test('cancelar sin un centro previo deja el cursor en pausa', () => {
    const { motor, de } = motorCon();
    motor.estado.calibrado = false;
    motor.calibrar();

    motor.cancelarCalibracion();

    expect(de('calibracion').at(-1)).toMatchObject({ estado: 'cancelada' });
    expect(motor.estado.modo).toBe('pausa');
  });

  test('sin casco no se puede calibrar', () => {
    const { motor } = motorCon({ sembrado: false });
    expect(() => motor.calibrar()).toThrowError(
      expect.objectContaining({ codigo: 'MODO_INVALIDO' }),
    );
  });
});

describe('gestos simulados', () => {
  test('en modo cursor, un gesto mapeado produce gesto + accion ejecutada', () => {
    const { motor, emitidos } = motorCon();

    motor.simularGesto('clench');

    expect(emitidos).toEqual([
      ['gesto', { gesto: 'clench', zona: 'inferior', potencia: 0.85 }],
      [
        'accion',
        {
          accion: 'clic',
          origen: { tipo: 'gesto', nombre: 'clench' },
          modo: 'cursor',
          ejecutada: true,
          motivo: null,
        },
      ],
    ]);
  });

  test('un gesto sin acción asignada solo se informa', () => {
    const { motor, emitidos } = motorCon();
    motor.simularGesto('blink');
    expect(emitidos.map(([tipo]) => tipo)).toEqual(['gesto']);
  });

  test('dos acciones demasiado seguidas: la segunda no se ejecuta (cooldown)', () => {
    let reloj = 10_000;
    const { motor, de } = motorCon({ ahora: () => reloj });

    motor.simularGesto('clench');
    reloj += 400;
    motor.simularGesto('clench');
    reloj += 1000;
    motor.simularGesto('clench');

    expect(de('accion').map((a) => [a['ejecutada'], a['motivo']])).toEqual([
      [true, null],
      [false, 'cooldown'],
      [true, null],
    ]);
  });

  test('en el comunicador, los gestos de selección llegan como `entrada` y no hacen clic', () => {
    const { motor, de } = motorCon();
    motor.cambiarModo('comunicador');

    motor.simularGesto('clench');

    expect(de('entrada')).toEqual([{ accion: 'seleccionar' }]);
    expect(de('accion').at(-1)).toMatchObject({ accion: 'seleccionar', modo: 'comunicador' });
  });

  test('el guiño izquierdo pausa y reanuda; en pausa los clics no se ejecutan', () => {
    let reloj = 0;
    const { motor, de } = motorCon({ ahora: () => (reloj += 2000) });

    motor.simularGesto('winkL');
    expect(motor.estado.modo).toBe('pausa');

    motor.simularGesto('clench');
    expect(de('accion').at(-1)).toMatchObject({ ejecutada: false, motivo: 'pausado' });

    motor.simularGesto('winkL');
    expect(motor.estado.modo).toBe('cursor');
  });

  test('el gesto de rescate alterna cursor ↔ comunicador', () => {
    let reloj = 0;
    const { motor, de } = motorCon({ ahora: () => (reloj += 2000) });

    motor.simularGesto('surprise');
    expect(de('modo').at(-1)).toEqual({
      modo: 'comunicador',
      pausado: false,
      motivo: 'gesto_rescate',
    });

    motor.simularGesto('surprise');
    expect(motor.estado.modo).toBe('cursor');
  });

  test('un gesto desconocido se rechaza como en el motor', () => {
    const { motor } = motorCon();
    expect(() => motor.simularGesto('baile')).toThrowError(
      expect.objectContaining({ status: 422, codigo: 'VALIDACION' }),
    );
  });

  test('simular mal contacto baja la calidad de cuatro sensores', () => {
    const { motor, de } = motorCon();

    motor.simularContacto(true);

    const dispositivo = de('dispositivo').at(-1) as {
      contacto: Record<string, number>;
      calidad_global: number;
    };
    expect(dispositivo.contacto).toMatchObject({ T7: 1, P7: 1, O1: 1, FC6: 1, AF3: 4 });
    expect(dispositivo.calidad_global).toBe(79);
  });
});

describe('perfiles y ajustes', () => {
  test('crear, renombrar y eliminar', () => {
    const { motor } = motorCon();

    const nuevo = motor.crearPerfil({ nombre: '  Lucía ' });
    expect(nuevo).toMatchObject({ nombre: 'Lucía', cortex_profile: null });

    expect(motor.editarPerfil(nuevo.id, { nombre: 'Lucía M.' }).nombre).toBe('Lucía M.');

    motor.eliminarPerfil(nuevo.id);
    expect(() => motor.obtenerPerfil(nuevo.id)).toThrowError(
      expect.objectContaining({ status: 404, codigo: 'PERFIL_NO_ENCONTRADO' }),
    );
  });

  test('un nombre vacío no es válido', () => {
    const { motor } = motorCon();
    expect(() => motor.crearPerfil({ nombre: '   ' })).toThrowError(
      expect.objectContaining({ status: 422, codigo: 'VALIDACION' }),
    );
  });

  test('activar un perfil emite sus ajustes', () => {
    const { motor, de } = motorCon();
    const pedro = motor.perfiles[1]!;

    const estado = motor.activarPerfil(pedro.id);

    expect(estado.perfil_activo_id).toBe(pedro.id);
    expect(de('ajustes').at(-1)).toMatchObject({ perfil_id: pedro.id });
  });

  test('guardar ajustes del perfil activo los aplica en caliente (evento ajustes)', () => {
    const { motor, de } = motorCon();
    const ana = motor.perfiles[0]!;
    const ajustes = motor.obtenerAjustes(ana.id);
    ajustes.cursor.ganancia_x = 60;

    motor.guardarAjustes(ana.id, ajustes);

    expect(de('ajustes')).toHaveLength(1);
    expect(motor.obtenerAjustes(ana.id).cursor.ganancia_x).toBe(60);
    // Los de otro perfil se guardan, pero no se aplican.
    motor.guardarAjustes(motor.perfiles[1]!.id, ajustes);
    expect(de('ajustes')).toHaveLength(1);
  });

  test('eliminar el perfil activo deja el motor sin perfil', () => {
    const { motor, de } = motorCon();

    motor.eliminarPerfil(motor.perfiles[0]!.id);

    expect(motor.estado.perfil_activo_id).toBeNull();
    expect(de('ajustes').at(-1)).toMatchObject({ perfil_id: '' });
  });
});

describe('sesiones y métricas', () => {
  const intento = (n: number, dx: number, ms: number, acierto = true): Intento => ({
    n,
    t_inicio_ms: n * 2000,
    t_fin_ms: n * 2000 + ms,
    objetivo: { x: 400, y: 100, ancho: 80 },
    origen: { x: 100, y: 100 },
    clic: { x: 400 + dx, y: 100 },
    acierto,
    dpr: 1,
  });

  test('una práctica completa: intentos → finalizar → métricas', () => {
    let reloj = Date.parse('2026-12-14T10:30:00Z');
    const { motor } = motorCon({ ahora: () => reloj });
    const sesion = motor.crearSesion('practica');

    motor.agregarIntentos(sesion.id, [intento(0, -10, 1000), intento(1, 10, 1000)]);
    motor.agregarIntentos(sesion.id, [intento(2, 0, 1000), intento(3, 60, 1000, false)]);
    reloj += 120_000;
    const final = motor.finalizarSesion(sesion.id);

    expect(final.fin).toBe('2026-12-14T10:32:00+00:00');
    expect(final.metricas).toMatchObject({
      tiempo_medio_ms: 1000,
      precision: 0.75,
      falsos_positivos_min: 0.5,
      caracteres_min: null,
    });
    expect(final.metricas?.throughput_bps).toBeGreaterThan(0);
  });

  test('no se pueden añadir intentos a una sesión terminada', () => {
    const { motor } = motorCon();
    const sesion = motor.crearSesion('practica');
    motor.finalizarSesion(sesion.id);

    expect(() => motor.agregarIntentos(sesion.id, [intento(0, 0, 900)])).toThrowError(
      expect.objectContaining({ status: 409 }),
    );
  });

  test('el comunicador mide caracteres por minuto con los enunciados', () => {
    const { motor } = motorCon();
    const sesion = motor.crearSesion('comunicador');

    motor.agregarEnunciado(sesion.id, {
      texto: 'TENGO SED',
      duracion_ms: 60_000,
      selecciones: 20,
      correcciones: 1,
    });

    expect(motor.finalizarSesion(sesion.id).metricas?.caracteres_min).toBe(9);
  });

  test('lista por perfil, la más reciente primero', () => {
    let reloj = Date.parse('2026-12-01T10:00:00Z');
    const { motor } = motorCon({ ahora: () => reloj });
    const ana = motor.perfiles[0]!.id;
    const primera = motor.crearSesion('practica');
    reloj += 3_600_000;
    const segunda = motor.crearSesion('comunicador');
    motor.activarPerfil(motor.perfiles[1]!.id);
    motor.crearSesion('libre');

    expect(motor.listarSesiones({ perfil_id: ana }).map((s) => s.id)).toEqual([
      segunda.id,
      primera.id,
    ]);
    expect(motor.listarSesiones({ desde: '2026-12-01T10:30:00Z' })).toHaveLength(2);
    expect(motor.listarSesiones()).toHaveLength(3);
  });

  test('exporta CSV con cabecera y una fila por sesión', () => {
    const { motor } = motorCon();
    motor.finalizarSesion(motor.crearSesion('practica').id);

    const [cabecera, fila] = motor.exportarCsv().split('\r\n');

    expect(cabecera).toBe(
      'id,perfil,tipo,inicio,fin,throughput_bps,tiempo_medio_ms,precision,falsos_positivos_min,caracteres_min',
    );
    expect(fila).toMatch(/^s-\d+,Ana,practica,/);
  });

  test('throughput ISO 9241-411: coincide con el cálculo a mano', () => {
    // A = 300, clics en dx = −10, 0, +10 → SD = 10, We = 41.33, Ae = 300, MT = 1 s
    const tp = throughput([intento(0, -10, 1000), intento(1, 0, 1000), intento(2, 10, 1000)]);
    expect(tp).toBeCloseTo(Math.log2(300 / 41.33 + 1), 6);
  });

  test('sin dispersión o con un solo intento no hay throughput', () => {
    expect(throughput([intento(0, 5, 1000)])).toBeNull();
    expect(throughput([intento(0, 5, 1000), intento(1, 5, 1000)])).toBeNull();
    expect(calcularMetricas('2026-12-01T10:00:00Z', null, [], [])).toEqual({
      throughput_bps: null,
      tiempo_medio_ms: null,
      precision: null,
      falsos_positivos_min: null,
      caracteres_min: null,
    });
  });
});

describe('entrenamiento', () => {
  test('iniciado → exito → aceptar guarda y vuelve al modo anterior', () => {
    const { motor, de } = motorCon({ entrenamientoMs: 800 });

    const { id } = motor.iniciarEntrenamiento('mental', 'push');
    expect(id).toMatch(/^e-/);
    expect(motor.estado.modo).toBe('entrenando');
    expect(de('entrenamiento')).toEqual([
      { fase: 'iniciado', deteccion: 'mental', accion: 'push' },
    ]);

    vi.advanceTimersByTime(800);
    expect(de('entrenamiento').at(-1)).toMatchObject({ fase: 'exito' });

    motor.responderEntrenamiento(true);
    expect(de('entrenamiento').at(-1)).toMatchObject({ fase: 'guardado' });
    expect(motor.estado.modo).toBe('cursor');
  });

  test('rechazar descarta el intento', () => {
    const { motor, de } = motorCon();
    motor.iniciarEntrenamiento('facial', 'neutral');
    vi.advanceTimersByTime(1000);

    motor.responderEntrenamiento(false);

    expect(de('entrenamiento').at(-1)).toMatchObject({ fase: 'rechazado' });
  });

  test('responder sin un entrenamiento en curso es un error', () => {
    const { motor } = motorCon();
    expect(() => motor.responderEntrenamiento(true)).toThrowError(
      expect.objectContaining({ codigo: 'MODO_INVALIDO' }),
    );
  });

  test('pedir otro modo cancela el entrenamiento', () => {
    const { motor, de } = motorCon();
    motor.iniciarEntrenamiento('mental', 'push');

    motor.cambiarModo('comunicador');
    vi.advanceTimersByTime(5000);

    expect(motor.estado.modo).toBe('comunicador');
    expect(de('entrenamiento')).toHaveLength(1); // ya no llega el `exito`
  });
});

test('fallarConexion deja el motor desconectado con su código', () => {
  const { motor, de } = motorCon();

  motor.fallarConexion('CASCO_DESCONECTADO', 'El casco se desconectó');

  expect(de('conexion').at(-1)).toMatchObject({ estado: 'error', codigo: 'CASCO_DESCONECTADO' });
  expect(de('error').at(-1)).toMatchObject({ codigo: 'CASCO_DESCONECTADO', recuperable: true });
  expect(motor.estado.modo).toBe('desconectado');
  expect(motor.dispositivo().calidad_global).toBe(0);
});
