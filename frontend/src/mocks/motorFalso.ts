// Motor de mentira, en memoria. Se comporta como el motor real (backend/) según el contrato:
// mismas respuestas, mismos eventos y las mismas reglas de modos. Lo usan:
//   - `npm run dev:mock`: la app completa sin backend (MSW lo conecta a fetch y al WebSocket).
//   - Las pruebas de pantallas: sin red, llamando a sus métodos directamente.
// Los datos de partida salen de contrato/ejemplos/.
import ejemploAjustes from '@contrato/ejemplos/rest/ajustes.json';
import ejemploSalud from '@contrato/ejemplos/rest/salud.json';
import type {
  Accion,
  Ajustes,
  CodigoError,
  DatosEvento,
  Deteccion,
  EntrenamientoIniciado,
  Enunciado,
  Estado,
  EvDispositivo,
  EvEntrenamiento,
  EvGesto,
  EvHola,
  EvModo,
  GestosDisponibles,
  Intento,
  Modo,
  ModoActual,
  ModoPedible,
  Perfil,
  PerfilCrear,
  PerfilEditar,
  Salud,
  Sesion,
  TipoEvento,
  TipoSesion,
} from '../api/tipos';
import { SENSORES } from '../api/tipos';
import type { FiltroSesiones } from '../api/rest';
import { calcularMetricas } from './metricas';

/** Error con la misma forma que los del motor: código HTTP + `{ codigo, mensaje }`. */
export class ErrorMotorFalso extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorMotorFalso';
  }
}

export const AJUSTES_POR_DEFECTO = ejemploAjustes as Ajustes;

const CASCO = 'EPOCX-SIMULADO';
const MODOS_USUARIO: Modo[] = ['cursor', 'comunicador', 'pausa'];
const CLICS: Accion[] = ['clic', 'clic_derecho', 'doble_clic'];
const SENSORES_CON_MAL_CONTACTO = ['T7', 'P7', 'O1', 'FC6'];

/** Gestos que entiende el simulador del motor y su zona. */
export const GESTOS_SIMULABLES: Record<string, EvGesto['zona']> = {
  clench: 'inferior',
  smile: 'inferior',
  laugh: 'inferior',
  smirkLeft: 'inferior',
  smirkRight: 'inferior',
  surprise: 'superior',
  frown: 'superior',
  blink: 'ojos',
  winkL: 'ojos',
  winkR: 'ojos',
  lookL: 'ojos',
  lookR: 'ojos',
  push: 'mental',
};

const GESTOS_DISPONIBLES: GestosDisponibles = {
  facial: {
    ojos: ['blink', 'winkL', 'winkR', 'lookL', 'lookR'],
    superior: ['surprise', 'frown'],
    inferior: ['clench', 'smile', 'laugh', 'smirkLeft', 'smirkRight'],
  },
  mental: ['push', 'pull', 'lift', 'drop', 'left', 'right'],
};

export interface OpcionesMotorFalso {
  /** Arranca con dos perfiles (Ana activa) y el casco conectado y calibrado. Por defecto, sí. */
  sembrado?: boolean;
  /** Sesiones de las últimas semanas, para que el historial tenga algo que mostrar. */
  conHistorial?: boolean;
  /** Emite `dispositivo` y `orientacion` periódicamente, como el motor real. */
  latidos?: boolean;
  /** Cuánto tarda la calibración simulada. */
  calibracionMs?: number;
  /** Cuánto tarda en llegar el `exito` de un entrenamiento (el casco real tarda ~8 s). */
  entrenamientoMs?: number;
  /** Reloj, para pruebas. */
  ahora?: () => number;
}

const copia = <T>(valor: T): T => structuredClone(valor);
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00');

export class MotorFalso {
  /** A dónde van los eventos. Lo fija quien aloja al motor (MSW o las pruebas). */
  emitir: <K extends TipoEvento>(tipo: K, datos: DatosEvento[K]) => void = () => undefined;

  estado: Estado;
  perfiles: Perfil[] = [];
  sesiones: Sesion[] = [];
  /** Textos que se pidió decir con la voz de respaldo. */
  dicho: string[] = [];
  bateria = 82;
  malContacto = false;
  cabeza = { yaw: 0, pitch: 0 };

  private readonly ajustesPorPerfil = new Map<string, Ajustes>();
  private readonly intentos = new Map<string, Intento[]>();
  private readonly enunciados = new Map<string, Enunciado[]>();
  private readonly ahora: () => number;
  private readonly calibracionMs: number;
  private readonly entrenamientoMs: number;
  private readonly temporizadores = new Set<ReturnType<typeof setTimeout>>();
  private intervalos: ReturnType<typeof setInterval>[] = [];
  private modoPrevio: Modo = 'cursor';
  private calibracion: ReturnType<typeof setInterval> | null = null;
  private entreno: EvEntrenamiento | null = null;
  private ultimaAccion = -Infinity;
  private contador = 0;

  constructor(opciones: OpcionesMotorFalso = {}) {
    this.ahora = opciones.ahora ?? Date.now;
    this.calibracionMs = opciones.calibracionMs ?? 2000;
    this.entrenamientoMs = opciones.entrenamientoMs ?? 1000;
    this.estado = {
      conexion: { estado: 'desconectado', casco_id: null, detalle: null },
      modo: 'desconectado',
      pausado: false,
      calibrado: false,
      perfil_activo_id: null,
      latencia_ms: { p50: 0, p95: 0 },
    };
    if (opciones.sembrado ?? true) {
      const ana = this.nuevoPerfil('Ana', this.ahora() - 9 * 86_400_000);
      this.nuevoPerfil('Pedro', this.ahora() - 2 * 86_400_000);
      this.estado.perfil_activo_id = ana.id;
      this.estado.conexion = { estado: 'conectado', casco_id: CASCO, detalle: null };
      this.estado.modo = 'cursor';
      this.estado.calibrado = true;
      this.estado.latencia_ms = { p50: 6.4, p95: 14.2 };
      if (opciones.conHistorial) this.sembrarHistorial(ana.id);
    }
    if (opciones.latidos) this.arrancarLatidos();
  }

  // ================================================================= eventos
  get ajustes(): Ajustes {
    return this.ajustesPorPerfil.get(this.estado.perfil_activo_id ?? '') ?? AJUSTES_POR_DEFECTO;
  }

  hola(): EvHola {
    return {
      version: ejemploSalud.version,
      estado: copia(this.estado),
      ajustes: copia(this.ajustes),
    };
  }

  dispositivo(): EvDispositivo {
    const conectado = this.estado.conexion.estado === 'conectado';
    const contacto = Object.fromEntries(
      SENSORES.map((s) => [
        s,
        !conectado ? 0 : this.malContacto && SENSORES_CON_MAL_CONTACTO.includes(s) ? 1 : 4,
      ]),
    );
    const suma = Object.values(contacto).reduce((a, b) => a + b, 0);
    return {
      bateria_pct: Math.round(this.bateria),
      senal: this.malContacto ? 0.8 : 1,
      contacto,
      calidad_global: Math.round((suma / (4 * SENSORES.length)) * 100),
    };
  }

  /** Detiene todo lo programado (latidos, calibración, entrenamiento). */
  detener(): void {
    this.intervalos.forEach(clearInterval);
    this.intervalos = [];
    if (this.calibracion) clearInterval(this.calibracion);
    this.calibracion = null;
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores.clear();
  }

  private arrancarLatidos(): void {
    this.intervalos.push(
      setInterval(() => {
        if (this.estado.conexion.estado !== 'conectado') return;
        this.bateria = Math.max(5, this.bateria - 0.01);
        this.emitir('dispositivo', this.dispositivo());
      }, 1000),
      setInterval(() => {
        if (this.estado.conexion.estado !== 'conectado' || this.estado.modo === 'calibrando')
          return;
        const temblor = () => (Math.random() - 0.5) * 0.06; // micro-temblor de la cabeza
        this.emitir('orientacion', {
          yaw: Number((this.cabeza.yaw + temblor()).toFixed(2)),
          pitch: Number((this.cabeza.pitch + temblor()).toFixed(2)),
          calibrado: this.estado.calibrado,
        });
      }, 100),
    );
  }

  private despues(ms: number, tarea: () => void): void {
    const id = setTimeout(() => {
      this.temporizadores.delete(id);
      tarea();
    }, ms);
    this.temporizadores.add(id);
  }

  // ================================================================== estado
  salud(): Salud {
    return { ...(ejemploSalud as Salud) };
  }

  conectar(): void {
    if (this.estado.conexion.estado === 'conectado') return;
    this.fijarConexion({ estado: 'conectando', casco_id: null, detalle: null });
    this.despues(300, () => {
      this.fijarConexion({ estado: 'conectado', casco_id: CASCO, detalle: null });
      this.emitir('dispositivo', this.dispositivo());
      this.calibrar();
    });
  }

  desconectar(): void {
    this.fijarConexion({ estado: 'desconectado', casco_id: null, detalle: null });
    this.fijarModo('desconectado', 'conexion');
  }

  /** Para pruebas y para el panel de desarrollo: el casco "se cae" con un código de error. */
  fallarConexion(codigo: CodigoError, detalle: string): void {
    if (this.calibracion) clearInterval(this.calibracion);
    this.calibracion = null;
    this.fijarConexion({ estado: 'error', casco_id: null, detalle }, codigo);
    this.emitir('error', { codigo, mensaje: detalle, recuperable: true });
    this.fijarModo('desconectado', 'conexion');
  }

  private fijarConexion(conexion: Estado['conexion'], codigo: CodigoError | null = null): void {
    this.estado.conexion = conexion;
    this.emitir('conexion', { ...conexion, codigo });
  }

  // =================================================================== modos
  private fijarModo(modo: Modo, motivo: EvModo['motivo']): void {
    if (this.estado.modo === modo) return;
    this.estado.modo = modo;
    this.estado.pausado = modo === 'pausa';
    this.emitir('modo', { modo, pausado: this.estado.pausado, motivo });
  }

  cambiarModo(modo: ModoPedible, motivo: EvModo['motivo'] = 'usuario'): ModoActual {
    if (this.estado.modo === 'entrenando') this.terminarEntreno(); // pedir otro modo lo cancela
    if (!MODOS_USUARIO.includes(this.estado.modo)) {
      throw new ErrorMotorFalso(
        409,
        'MODO_INVALIDO',
        `No se puede pasar de ${this.estado.modo} a ${modo}`,
      );
    }
    this.fijarModo(modo, motivo);
    return { modo: this.estado.modo, pausado: this.estado.pausado };
  }

  /** Como el motor: si se cierra la última ventana en el comunicador, vuelve a cursor. */
  interfazDesconectada(): void {
    if (this.estado.modo === 'entrenando') this.terminarEntreno();
    if (this.estado.modo === 'comunicador') this.fijarModo('cursor', 'ui_desconectada');
  }

  // ============================================================= calibración
  calibrar(): void {
    if (this.estado.conexion.estado !== 'conectado') {
      throw new ErrorMotorFalso(409, 'MODO_INVALIDO', 'No hay casco conectado');
    }
    if (this.calibracion) clearInterval(this.calibracion);
    if (MODOS_USUARIO.includes(this.estado.modo)) this.modoPrevio = this.estado.modo;
    this.fijarModo('calibrando', 'calibracion');
    const instruccion = 'Mira al centro y no te muevas';
    this.emitir('calibracion', { estado: 'en_curso', progreso: 0, instruccion });

    const pasoMs = 200;
    let transcurrido = 0;
    this.calibracion = setInterval(() => {
      transcurrido += pasoMs;
      if (transcurrido < this.calibracionMs) {
        const progreso = Number((transcurrido / this.calibracionMs).toFixed(2));
        this.emitir('calibracion', { estado: 'en_curso', progreso, instruccion });
        return;
      }
      if (this.calibracion) clearInterval(this.calibracion);
      this.calibracion = null;
      this.estado.calibrado = true;
      this.emitir('calibracion', {
        estado: 'completada',
        progreso: 1,
        instruccion: 'Calibración completada',
      });
      this.fijarModo(this.modoPrevio, 'calibracion');
    }, pasoMs);
  }

  cancelarCalibracion(): void {
    if (!this.calibracion) return;
    clearInterval(this.calibracion);
    this.calibracion = null;
    this.emitir('calibracion', {
      estado: 'cancelada',
      progreso: 0,
      instruccion: 'Calibración cancelada',
    });
    // Sin un centro previo no se puede mover el cursor: queda en pausa hasta calibrar.
    this.fijarModo(this.estado.calibrado ? this.modoPrevio : 'pausa', 'calibracion');
  }

  gestosDisponibles(): GestosDisponibles {
    return copia(GESTOS_DISPONIBLES);
  }

  // ================================================================ perfiles
  private nuevoPerfil(nombre: string, creadoMs = this.ahora()): Perfil {
    const perfil: Perfil = {
      id: `p-${++this.contador}`,
      nombre,
      cortex_profile: null,
      creado_en: iso(creadoMs),
    };
    this.perfiles.push(perfil);
    this.ajustesPorPerfil.set(perfil.id, copia(AJUSTES_POR_DEFECTO));
    return perfil;
  }

  private perfil(id: string): Perfil {
    const perfil = this.perfiles.find((p) => p.id === id);
    if (!perfil)
      throw new ErrorMotorFalso(404, 'PERFIL_NO_ENCONTRADO', `No existe el perfil ${id}`);
    return perfil;
  }

  private validarNombre(nombre: string): string {
    const limpio = nombre.trim();
    if (limpio.length < 1 || nombre.length > 60) {
      throw new ErrorMotorFalso(422, 'VALIDACION', 'Datos no válidos');
    }
    return limpio;
  }

  listarPerfiles(): Perfil[] {
    return copia(this.perfiles);
  }

  crearPerfil(datos: PerfilCrear): Perfil {
    const perfil = this.nuevoPerfil(this.validarNombre(datos.nombre));
    perfil.cortex_profile = datos.cortex_profile ?? null;
    return copia(perfil);
  }

  obtenerPerfil(id: string): Perfil {
    return copia(this.perfil(id));
  }

  editarPerfil(id: string, cambios: PerfilEditar): Perfil {
    const perfil = this.perfil(id);
    if (typeof cambios.nombre === 'string') perfil.nombre = this.validarNombre(cambios.nombre);
    if (cambios.cortex_profile !== undefined) perfil.cortex_profile = cambios.cortex_profile;
    return copia(perfil);
  }

  eliminarPerfil(id: string): void {
    this.perfil(id);
    this.perfiles = this.perfiles.filter((p) => p.id !== id);
    this.ajustesPorPerfil.delete(id);
    this.sesiones = this.sesiones.filter((s) => s.perfil_id !== id);
    if (this.estado.perfil_activo_id === id) {
      this.estado.perfil_activo_id = null;
      this.emitir('ajustes', { perfil_id: '', ajustes: copia(AJUSTES_POR_DEFECTO) });
    }
  }

  activarPerfil(id: string): Estado {
    this.perfil(id);
    this.estado.perfil_activo_id = id;
    this.emitir('ajustes', { perfil_id: id, ajustes: copia(this.ajustes) });
    return copia(this.estado);
  }

  obtenerAjustes(id: string): Ajustes {
    this.perfil(id);
    return copia(this.ajustesPorPerfil.get(id) ?? AJUSTES_POR_DEFECTO);
  }

  guardarAjustes(id: string, ajustes: Ajustes): Ajustes {
    this.perfil(id);
    this.ajustesPorPerfil.set(id, copia(ajustes));
    if (this.estado.perfil_activo_id === id) {
      this.emitir('ajustes', { perfil_id: id, ajustes: copia(ajustes) });
    }
    return copia(ajustes);
  }

  // ================================================================ sesiones
  private sesion(id: string): Sesion {
    const sesion = this.sesiones.find((s) => s.id === id);
    if (!sesion) throw new ErrorMotorFalso(404, 'VALIDACION', `No existe la sesión ${id}`);
    return sesion;
  }

  private sesionAbierta(id: string): Sesion {
    const sesion = this.sesion(id);
    if (sesion.fin) throw new ErrorMotorFalso(409, 'VALIDACION', 'La sesión ya terminó');
    return sesion;
  }

  crearSesion(tipo: TipoSesion): Sesion {
    const perfilId = this.estado.perfil_activo_id;
    if (!perfilId || !this.perfiles.some((p) => p.id === perfilId)) {
      throw new ErrorMotorFalso(
        409,
        'PERFIL_NO_ENCONTRADO',
        'Activa un perfil antes de iniciar una sesión',
      );
    }
    const sesion: Sesion = {
      id: `s-${++this.contador}`,
      perfil_id: perfilId,
      tipo,
      inicio: iso(this.ahora()),
      fin: null,
      metricas: null,
    };
    this.sesiones.push(sesion);
    return copia(sesion);
  }

  listarSesiones({ perfil_id, desde, hasta }: FiltroSesiones = {}): Sesion[] {
    return copia(
      this.sesiones
        .filter((s) => !perfil_id || s.perfil_id === perfil_id)
        .filter((s) => !desde || Date.parse(s.inicio) >= Date.parse(desde))
        .filter((s) => !hasta || Date.parse(s.inicio) <= Date.parse(hasta))
        .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio)),
    );
  }

  obtenerSesion(id: string): Sesion {
    return copia(this.sesion(id));
  }

  agregarIntentos(id: string, intentos: Intento[]): void {
    this.sesionAbierta(id);
    this.intentos.set(id, [...(this.intentos.get(id) ?? []), ...copia(intentos)]);
  }

  agregarEnunciado(id: string, enunciado: Enunciado): void {
    this.sesionAbierta(id);
    this.enunciados.set(id, [...(this.enunciados.get(id) ?? []), copia(enunciado)]);
  }

  finalizarSesion(id: string): Sesion {
    const sesion = this.sesion(id);
    sesion.fin ??= iso(this.ahora());
    sesion.metricas = calcularMetricas(
      sesion.inicio,
      sesion.fin,
      this.intentos.get(id) ?? [],
      this.enunciados.get(id) ?? [],
    );
    return copia(sesion);
  }

  exportarCsv(perfilId?: string): string {
    const campos = [
      'throughput_bps',
      'tiempo_medio_ms',
      'precision',
      'falsos_positivos_min',
      'caracteres_min',
    ] as const;
    const nombres = new Map(this.perfiles.map((p) => [p.id, p.nombre]));
    const filas = this.listarSesiones({ perfil_id: perfilId }).map((s) =>
      [
        s.id,
        nombres.get(s.perfil_id) ?? s.perfil_id,
        s.tipo,
        s.inicio,
        s.fin ?? '',
        ...campos.map((c) => s.metricas?.[c]?.toFixed(3) ?? ''),
      ].join(','),
    );
    return [`id,perfil,tipo,inicio,fin,${campos.join(',')}`, ...filas].join('\r\n') + '\r\n';
  }

  // =========================================================== entrenamiento
  iniciarEntrenamiento(deteccion: Deteccion, accion: string): EntrenamientoIniciado {
    if (this.estado.conexion.estado !== 'conectado') {
      throw new ErrorMotorFalso(409, 'MODO_INVALIDO', 'No hay casco conectado');
    }
    if (!MODOS_USUARIO.includes(this.estado.modo)) {
      throw new ErrorMotorFalso(
        409,
        'MODO_INVALIDO',
        `No se puede entrenar en modo ${this.estado.modo}`,
      );
    }
    this.modoPrevio = this.estado.modo;
    const entreno: EvEntrenamiento = { fase: 'iniciado', deteccion, accion };
    this.entreno = entreno;
    this.fijarModo('entrenando', 'entrenamiento');
    this.emitir('entrenamiento', { ...entreno });
    this.despues(this.entrenamientoMs, () => {
      if (this.entreno !== entreno) return;
      entreno.fase = 'exito';
      this.emitir('entrenamiento', { ...entreno });
    });
    return { id: `e-${++this.contador}` };
  }

  responderEntrenamiento(aceptar: boolean): void {
    if (!this.entreno) {
      throw new ErrorMotorFalso(409, 'MODO_INVALIDO', 'No hay un entrenamiento en curso');
    }
    this.emitir('entrenamiento', { ...this.entreno, fase: aceptar ? 'guardado' : 'rechazado' });
    this.terminarEntreno();
  }

  private terminarEntreno(): void {
    this.entreno = null;
    if (this.estado.modo === 'entrenando') this.fijarModo(this.modoPrevio, 'entrenamiento');
  }

  // ===================================================================== voz
  hablar(texto: string): void {
    this.dicho.push(texto);
  }

  // ============================================================== simulación
  simularGesto(gesto: string): void {
    const zona = GESTOS_SIMULABLES[gesto];
    if (!zona) throw new ErrorMotorFalso(422, 'VALIDACION', `Gesto desconocido: ${gesto}`);
    this.emitir('gesto', { gesto, zona, potencia: zona === 'ojos' ? 1 : 0.85 });

    const modo = this.estado.modo;
    if (!MODOS_USUARIO.includes(modo)) return;
    const { gesto_rescate, mapeo } = this.ajustes.gestos;
    if (gesto === gesto_rescate) {
      if (this.antirrebote()) {
        this.cambiarModo(modo !== 'comunicador' ? 'comunicador' : 'cursor', 'gesto_rescate');
      }
      return;
    }
    const accion = (modo === 'comunicador' ? mapeo.comunicador : mapeo.cursor)[gesto];
    if (!accion) return;
    const origen = {
      tipo: zona === 'mental' ? ('mental' as const) : ('gesto' as const),
      nombre: gesto,
    };
    if (!this.antirrebote()) {
      this.emitir('accion', { accion, origen, modo, ejecutada: false, motivo: 'cooldown' });
      return;
    }
    this.ejecutar(accion, origen);
  }

  private antirrebote(): boolean {
    const ahora = this.ahora();
    if (ahora - this.ultimaAccion < this.ajustes.gestos.cooldown_ms) return false;
    this.ultimaAccion = ahora;
    return true;
  }

  private ejecutar(accion: Accion, origen: DatosEvento['accion']['origen']): void {
    const modo = this.estado.modo;
    let ejecutada = true;
    let motivo: DatosEvento['accion']['motivo'] = null;
    if (accion === 'pausar') {
      if (modo === 'comunicador') ejecutada = false;
      else this.cambiarModo(modo === 'pausa' ? 'cursor' : 'pausa');
    } else if (accion === 'cambiar_modo') {
      this.cambiarModo(modo !== 'comunicador' ? 'comunicador' : 'cursor');
    } else if (modo === 'pausa') {
      ejecutada = false;
      motivo = 'pausado';
    } else if (modo === 'comunicador') {
      if (accion === 'seleccionar' || accion === 'atras') this.emitir('entrada', { accion });
      else ejecutada = false; // en el comunicador el ratón no se toca
    } else if (!CLICS.includes(accion)) {
      ejecutada = false;
    }
    this.emitir('accion', { accion, origen, modo, ejecutada, motivo });
  }

  simularCabeza(yaw: number, pitch: number): void {
    this.cabeza = { yaw, pitch: Math.max(-60, Math.min(60, pitch)) };
    this.emitir('orientacion', { ...this.cabeza, calibrado: this.estado.calibrado });
  }

  simularContacto(malo: boolean): void {
    this.malContacto = malo;
    this.emitir('dispositivo', this.dispositivo());
  }

  // ================================================================ historial
  /** Sesiones pasadas con una mejora gradual, para ver el historial con datos. */
  private sembrarHistorial(perfilId: string): void {
    const dia = 86_400_000;
    const hoy = this.ahora();
    for (let i = 0; i < 8; i += 1) {
      const inicio = hoy - (8 - i) * 3 * dia + 10 * 3_600_000;
      const avance = i / 7;
      this.sesiones.push({
        id: `s-${++this.contador}`,
        perfil_id: perfilId,
        tipo: 'practica',
        inicio: iso(inicio),
        fin: iso(inicio + 6 * 60_000),
        metricas: {
          throughput_bps: Number((0.6 + 1.2 * avance + (i % 2) * 0.08).toFixed(3)),
          tiempo_medio_ms: Math.round(2600 - 1100 * avance),
          precision: Number((0.72 + 0.22 * avance).toFixed(3)),
          falsos_positivos_min: Number((1.4 - 1.1 * avance).toFixed(3)),
          caracteres_min: null,
        },
      });
      this.sesiones.push({
        id: `s-${++this.contador}`,
        perfil_id: perfilId,
        tipo: 'comunicador',
        inicio: iso(inicio + 10 * 60_000),
        fin: iso(inicio + 22 * 60_000),
        metricas: {
          throughput_bps: null,
          tiempo_medio_ms: null,
          precision: null,
          falsos_positivos_min: null,
          caracteres_min: Number((4.5 + 4.5 * avance - (i % 3) * 0.3).toFixed(3)),
        },
      });
    }
  }
}
