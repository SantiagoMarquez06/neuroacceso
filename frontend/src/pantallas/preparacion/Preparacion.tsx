// Asistente de preparación (docs/pantallas.md §4.2): conexión → contacto → calibración → prueba
// de gestos. Cada paso avanza solo cuando se cumple su condición, así que la persona con el casco
// puede completar la calibración y la prueba sin manos; los botones son para el acompañante.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/rest';
import { AJUSTES_POR_DEFECTO } from '../../api/ajustesPorDefecto';
import {
  Aviso,
  BotonGrande,
  Icono,
  IndicadorEstado,
  MapaSensores,
  Medidor,
} from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useEvento } from '../../estado/conexion';
import { useMotor } from '../../estado/motor';
import { pedirModo } from '../../estado/ordenes';
import { Pantalla } from '../../estructura/Pantalla';
import { CONTACTO_BUENO } from '../../estructura/resumen';
import { ERRORES, NOMBRE_ACCION, ordenGesto, zonasPorRevisar } from '../../textos';
import estilos from './Preparacion.module.css';

type Paso = 0 | 1 | 2 | 3;
const PASOS = ['Conexión', 'Contacto', 'Calibración', 'Prueba de gestos'] as const;

/** Tiempo con buen contacto antes de pasar solo al siguiente paso (evita lecturas sueltas). */
export const CONTACTO_ESTABLE_MS = 1500;

const lista = (partes: string[]) =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(partes);

export function Preparacion() {
  const conectado = useMotor((s) => s.estado?.conexion.estado === 'conectado');
  const [paso, setPaso] = useState<Paso>(0);
  // Si el casco se cae a mitad, se vuelve al primer paso.
  const pasoVisible: Paso = conectado ? paso : 0;
  // Estables entre dibujos: los pasos los usan como dependencia de sus temporizadores.
  const siguiente = useCallback(() => setPaso((p) => Math.min(3, p + 1) as Paso), []);
  const aContacto = useCallback(() => setPaso(1), []);

  return (
    <Pantalla titulo="Preparación" ancho="lectura">
      <ol className={estilos.progreso} aria-label="Pasos">
        {PASOS.map((nombre, i) => (
          <li
            key={nombre}
            className={estilos.punto}
            data-estado={i < pasoVisible ? 'hecho' : i === pasoVisible ? 'actual' : 'pendiente'}
            aria-current={i === pasoVisible ? 'step' : undefined}
          >
            <span aria-hidden="true">{i < pasoVisible ? <Icono nombre="bien" /> : i + 1}</span>
            {nombre}
          </li>
        ))}
      </ol>
      <h2 className={estilos.titulo}>
        Paso {pasoVisible + 1} de 4: {PASOS[pasoVisible]}
      </h2>

      {pasoVisible === 0 && <PasoConexion alListo={aContacto} />}
      {pasoVisible === 1 && <PasoContacto alListo={siguiente} />}
      {pasoVisible === 2 && <PasoCalibracion alListo={siguiente} />}
      {pasoVisible === 3 && <PasoGestos />}
    </Pantalla>
  );
}

interface PropsPaso {
  alListo: () => void;
}

// ---- 1. Conexión -------------------------------------------------------------------------------
function PasoConexion({ alListo }: PropsPaso) {
  const estado = useMotor((s) => s.estado?.conexion.estado);
  const codigo = useMotor((s) => s.codigoConexion);

  useEffect(() => {
    if (estado === 'conectado') alListo();
  }, [estado, alListo]);

  const error = estado === 'error' ? ERRORES[codigo ?? 'CASCO_DESCONECTADO'] : null;
  return (
    <div className={estilos.paso}>
      <p className={estilos.instruccion}>Enciende el casco y abre el EMOTIV Launcher.</p>
      <p role="status">
        <IndicadorEstado
          tono={error ? 'mal' : estado === 'conectando' ? 'aviso' : 'apagado'}
          destacado
        >
          {error
            ? error.titulo
            : estado === 'conectando'
              ? 'Buscando el casco…'
              : 'Casco desconectado'}
        </IndicadorEstado>
      </p>
      {error && <p className={estilos.nota}>{error.ayuda}</p>}
      <div className={estilos.botones}>
        <BotonGrande
          variante="principal"
          icono="reintentar"
          onClick={() => api.conectar().catch(avisarError)}
        >
          Reintentar
        </BotonGrande>
      </div>
    </div>
  );
}

// ---- 2. Contacto -------------------------------------------------------------------------------
function PasoContacto({ alListo }: PropsPaso) {
  const dispositivo = useMotor((s) => s.dispositivo);
  const calidad = dispositivo?.calidad_global;
  const bueno = calidad !== undefined && calidad >= CONTACTO_BUENO;
  const zonas = zonasPorRevisar(dispositivo?.contacto ?? null);

  useEffect(() => {
    if (!bueno) return;
    const id = setTimeout(alListo, CONTACTO_ESTABLE_MS);
    return () => clearTimeout(id);
  }, [bueno, alListo]);

  return (
    <div className={estilos.paso}>
      <div className={estilos.contacto}>
        <MapaSensores contacto={dispositivo?.contacto ?? null} className={estilos.mapa} />
        <div className={estilos.columna}>
          {calidad !== undefined && (
            <Medidor
              valor={calidad / 100}
              etiqueta="Contacto global"
              tono={bueno ? 'bien' : 'aviso'}
            />
          )}
          <p className={estilos.instruccion} role="status">
            {bueno
              ? 'Buen contacto. Seguimos…'
              : zonas.length > 0
                ? `Humedece y ajusta los sensores de: ${lista(zonas)}.`
                : 'Esperando los datos del casco…'}
          </p>
          <p className={estilos.nota}>
            Hace falta al menos un {CONTACTO_BUENO} % para que los gestos se reconozcan bien.
          </p>
        </div>
      </div>
      <div className={estilos.botones}>
        <BotonGrande onClick={alListo}>Continuar de todas formas</BotonGrande>
      </div>
    </div>
  );
}

// ---- 3. Calibración ----------------------------------------------------------------------------
function PasoCalibracion({ alListo }: PropsPaso) {
  const calibracion = useMotor((s) => s.calibracion);
  const modo = useMotor((s) => s.estado?.modo);
  const calibrado = useMotor((s) => s.estado?.calibrado ?? false);
  const enCurso = modo === 'calibrando';

  // Se calibra al llegar a este paso (con la persona ya colocada y mirando al punto): al mojar y
  // ajustar los sensores la cabeza se movió, y el centro de antes ya no vale. Si el motor ya está
  // calibrando (lo hace solo al conectar), se espera a que termine.
  useEffect(() => {
    if (useMotor.getState().estado?.modo !== 'calibrando') {
      api.calibrar().catch(avisarError);
    }
  }, []); // solo al entrar en el paso

  useEvento('calibracion', ({ estado }) => {
    if (estado === 'completada') alListo();
  });

  const fallida = calibracion?.estado === 'fallida';
  return (
    <div className={estilos.paso}>
      <div className={estilos.calibracion}>
        <p className={estilos.instruccionGrande} role="status">
          {enCurso
            ? (calibracion?.instruccion ?? 'Mira al centro y no te muevas')
            : fallida
              ? calibracion.instruccion
              : calibrado
                ? 'Ya está calibrado. Puedes repetirlo si el cursor no queda centrado.'
                : 'Preparando la calibración…'}
        </p>
        <div className={estilos.diana} aria-hidden="true">
          <span />
        </div>
        {enCurso && (
          <Medidor valor={calibracion?.progreso ?? 0} etiqueta="Progreso de la calibración" />
        )}
      </div>
      <div className={estilos.botones}>
        <BotonGrande
          variante={fallida ? 'principal' : 'secundario'}
          icono="reintentar"
          disabled={enCurso}
          onClick={() => api.calibrar().catch(avisarError)}
        >
          Repetir
        </BotonGrande>
        <BotonGrande
          icono="siguiente"
          onClick={() => {
            // Saltar a mitad cancela la calibración en curso (el motor vuelve a su modo).
            if (enCurso) api.cancelarCalibracion().catch(avisarError);
            alListo();
          }}
        >
          {calibrado && !enCurso ? 'Continuar' : 'Saltar'}
        </BotonGrande>
      </div>
    </div>
  );
}

// ---- 4. Prueba de gestos -----------------------------------------------------------------------
function PasoGestos() {
  const navegar = useNavigate();
  const ajustes = useMotor((s) => s.ajustes) ?? AJUSTES_POR_DEFECTO;
  const rescate = ajustes.gestos.gesto_rescate;
  const aProbar = [...new Set([...Object.keys(ajustes.gestos.mapeo.cursor), rescate])];
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  const todos = aProbar.every((g) => hechos.has(g));

  useEvento('gesto', ({ gesto }) => {
    if (aProbar.includes(gesto)) setHechos((h) => new Set(h).add(gesto));
  });

  // El gesto de rescate pasa el motor al comunicador; aquí solo se está probando: se vuelve.
  useEvento('modo', ({ modo, motivo }) => {
    if (modo === 'comunicador' && motivo === 'gesto_rescate') {
      pedirModo('cursor').catch(() => undefined);
    }
  });

  return (
    <div className={estilos.paso}>
      <p className={estilos.instruccion}>
        Haz cada gesto. Se marcará cuando el casco lo reconozca.
      </p>
      <ul className={estilos.gestos} aria-label="Gestos a probar">
        {aProbar.map((gesto) => {
          const hecho = hechos.has(gesto);
          const accion =
            gesto === rescate
              ? 'Cambiar entre cursor y comunicador'
              : NOMBRE_ACCION[ajustes.gestos.mapeo.cursor[gesto] ?? 'ninguna'];
          return (
            <li key={gesto} data-hecho={hecho}>
              <span className={estilos.marca} aria-hidden="true">
                {hecho && <Icono nombre="bien" tamano="1.6rem" />}
              </span>
              <span>
                <strong>{ordenGesto(gesto)}</strong>
                <span className={estilos.nota}> — {accion}</span>
              </span>
              <span className="solo-lectores">{hecho ? ': reconocido' : ': pendiente'}</span>
            </li>
          );
        })}
      </ul>
      {Object.values(ajustes.gestos.mapeo.cursor).includes('pausar') && (
        <p className={estilos.nota}>
          Al probarlos, los gestos también actúan: si el cursor se pausa, vuelve a hacer el gesto de
          pausa para reanudarlo.
        </p>
      )}
      {todos && (
        <Aviso tono="bien" titulo="Todo listo">
          El casco reconoce todos tus gestos.
        </Aviso>
      )}
      <div className={estilos.botones}>
        <BotonGrande
          variante={todos ? 'principal' : 'secundario'}
          tamano={todos ? 'grande' : 'normal'}
          icono="siguiente"
          onClick={() => navegar('/estado')}
        >
          {todos ? 'Empezar' : 'Saltar'}
        </BotonGrande>
      </div>
    </div>
  );
}
