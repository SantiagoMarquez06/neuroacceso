// Entrenamiento (docs/pantallas.md §4.6, contrato v1.1): enseñar al casco los gestos y el comando
// mental de ESTA persona. Flujo: elegir → POST /entrenamiento → cuenta atrás con estímulo
// (evento `entrenamiento: iniciado`) → `exito` → Aceptar / Rechazar → `guardado`.
// Siempre se empieza por "relajado" (neutral): es la referencia contra la que Cortex compara.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/rest';
import type { Deteccion } from '../../api/tipos';
import { Aviso, BotonGrande, Medidor, Tarjeta } from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useEvento } from '../../estado/conexion';
import { useMotor } from '../../estado/motor';
import { pedirModo } from '../../estado/ordenes';
import { Pantalla } from '../../estructura/Pantalla';
import { nombreGesto, ordenGesto } from '../../textos';
import estilos from './Entrenamiento.module.css';

/** Duración de una toma con el casco real (Cortex). */
export const DURACION_TOMA_S = 8;

interface Opcion {
  deteccion: Deteccion;
  accion: string;
}

const OPCIONES: Record<Deteccion, string[]> = {
  mental: ['neutral', 'push'],
  facial: ['neutral', 'clench', 'smile', 'surprise', 'frown'],
};

const TITULO_DETECCION: Record<Deteccion, string> = {
  mental: 'Comando mental',
  facial: 'Gestos de la cara',
};

const clave = (o: Opcion) => `${o.deteccion}:${o.accion}`;

// ---- Lo ya entrenado por cada perfil, recordado en este equipo --------------------------------
const claveAlmacen = (perfilId: string) => `neuroacceso.entrenado.${perfilId}`;

function leerEntrenado(perfilId: string | null): Record<string, number> {
  if (!perfilId) return {};
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(claveAlmacen(perfilId)) ?? '{}');
    return valor && typeof valor === 'object' ? (valor as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function guardarEntrenado(perfilId: string | null, entrenado: Record<string, number>): void {
  if (!perfilId) return;
  try {
    localStorage.setItem(claveAlmacen(perfilId), JSON.stringify(entrenado));
  } catch {
    // Sin almacenamiento: solo se pierde el recordatorio de qué está entrenado.
  }
}

type Fase = 'eligiendo' | 'pidiendo' | 'tomando' | 'decidiendo' | 'guardado' | 'fallo';

export function Entrenamiento() {
  const perfilId = useMotor((s) => s.estado?.perfil_activo_id ?? null);
  const modo = useMotor((s) => s.estado?.modo);
  const conectado = useMotor((s) => s.estado?.conexion.estado === 'conectado');
  const [entrenado, setEntrenado] = useState(() => leerEntrenado(perfilId));
  const [id, setId] = useState<string | null>(null);
  const [faseGuardada, setFase] = useState<Fase>('eligiendo');
  const [toma, setToma] = useState(0); // reinicia la cuenta atrás en cada toma
  // El evento iniciado puede llegar antes de que React vuelva a dibujar: se mira una referencia.
  const actualRef = useRef<Opcion | null>(null);
  const [actual, setActual] = useState<Opcion | null>(null);

  useEvento('entrenamiento', ({ fase: f, deteccion, accion }) => {
    const enCurso = actualRef.current;
    if (!enCurso || deteccion !== enCurso.deteccion || accion !== enCurso.accion) return;
    if (f === 'iniciado') setFase('tomando');
    else if (f === 'exito') setFase('decidiendo');
    else if (f === 'fallo') setFase('fallo');
    else if (f === 'rechazado') setFase('eligiendo');
    else if (f === 'guardado') {
      const nuevo = { ...entrenado, [clave(enCurso)]: (entrenado[clave(enCurso)] ?? 0) + 1 };
      setEntrenado(nuevo);
      guardarEntrenado(perfilId, nuevo);
      setFase('guardado');
    }
  });

  // Si el motor sale del modo entrenando por su cuenta (cancelado, casco caído), se vuelve a elegir.
  const fase =
    (faseGuardada === 'tomando' || faseGuardada === 'decidiendo') && modo !== 'entrenando'
      ? 'eligiendo'
      : faseGuardada;

  const empezar = async (opcion: Opcion) => {
    actualRef.current = opcion;
    setActual(opcion);
    setToma((n) => n + 1);
    setFase('pidiendo');
    try {
      setId((await api.entrenamiento.iniciar(opcion.deteccion, opcion.accion)).id);
    } catch (error) {
      avisarError(error);
      setFase('eligiendo');
    }
  };

  const responder = async (aceptar: boolean) => {
    if (!id) return;
    try {
      await (aceptar ? api.entrenamiento.aceptar(id) : api.entrenamiento.rechazar(id));
    } catch (error) {
      avisarError(error);
    }
  };

  const cancelar = () => {
    setFase('eligiendo');
    pedirModo('cursor').catch(() => undefined); // pedir otro modo cancela el entrenamiento
  };

  if (actual && fase !== 'eligiendo') {
    return (
      <Pantalla
        titulo={`Entrenar: ${nombreGesto(actual.accion)}`}
        descripcion={TITULO_DETECCION[actual.deteccion]}
        ancho="lectura"
        acciones={
          (fase === 'tomando' || fase === 'pidiendo') && (
            <BotonGrande icono="cerrar" onClick={cancelar}>
              Cancelar
            </BotonGrande>
          )
        }
      >
        {modo === 'entrenando' && (
          <p className={estilos.modo} role="status">
            El cursor está detenido mientras se entrena.
          </p>
        )}
        <Toma key={toma} opcion={actual} fase={fase} />
        {fase === 'decidiendo' && (
          <Tarjeta titulo="¿Salió bien?" nivel={2}>
            <p>Acepta si lo hiciste como querías; si te distrajiste, recházalo y repítelo.</p>
            <div className={estilos.botones}>
              <BotonGrande
                variante="principal"
                tamano="grande"
                icono="bien"
                onClick={() => void responder(true)}
              >
                Aceptar
              </BotonGrande>
              <BotonGrande tamano="grande" icono="cerrar" onClick={() => void responder(false)}>
                Rechazar
              </BotonGrande>
            </div>
          </Tarjeta>
        )}
        {fase === 'guardado' && (
          <Aviso
            tono="bien"
            titulo="Entrenamiento guardado"
            acciones={
              <>
                <BotonGrande
                  variante="principal"
                  icono="reintentar"
                  onClick={() => void empezar(actual)}
                >
                  Otra vez
                </BotonGrande>
                <BotonGrande icono="volver" onClick={() => setFase('eligiendo')}>
                  Elegir otro
                </BotonGrande>
              </>
            }
          >
            Cuantas más tomas buenas, mejor lo reconoce. Se recomiendan al menos 3.
          </Aviso>
        )}
        {fase === 'fallo' && (
          <Aviso
            tono="mal"
            titulo="El casco no pudo registrar la toma"
            acciones={
              <>
                <BotonGrande
                  variante="principal"
                  icono="reintentar"
                  onClick={() => void empezar(actual)}
                >
                  Repetir
                </BotonGrande>
                <BotonGrande icono="volver" onClick={() => setFase('eligiendo')}>
                  Elegir otro
                </BotonGrande>
              </>
            }
          >
            Comprueba el contacto de los sensores y vuelve a intentarlo.
          </Aviso>
        )}
      </Pantalla>
    );
  }

  return (
    <Pantalla
      titulo="Entrenamiento"
      descripcion="Enseña al casco cómo haces cada gesto, para que te entienda mejor."
      ancho="lectura"
    >
      {!perfilId && (
        <Aviso tono="aviso" titulo="Elige un perfil: el entrenamiento es de cada persona" />
      )}
      {!conectado && <Aviso tono="aviso" titulo="Conecta el casco para entrenar" />}
      {(Object.keys(OPCIONES) as Deteccion[]).map((deteccion) => {
        const sinNeutral = !entrenado[clave({ deteccion, accion: 'neutral' })];
        return (
          <Tarjeta key={deteccion} titulo={TITULO_DETECCION[deteccion]} nivel={2}>
            {sinNeutral && (
              <p className={estilos.nota}>
                Empieza por <strong>Relajado</strong>: el casco necesita saber cómo estás sin hacer
                nada.
              </p>
            )}
            <ul className={estilos.opciones}>
              {OPCIONES[deteccion].map((accion) => {
                const opcion = { deteccion, accion };
                const tomas = entrenado[clave(opcion)] ?? 0;
                const bloqueada = accion !== 'neutral' && sinNeutral;
                return (
                  <li key={accion}>
                    <BotonGrande
                      variante={accion === 'neutral' && sinNeutral ? 'principal' : 'secundario'}
                      completo
                      disabled={bloqueada || !conectado || !perfilId}
                      onClick={() => void empezar(opcion)}
                    >
                      {nombreGesto(accion)}
                    </BotonGrande>
                    <span className={estilos.tomas}>
                      {tomas === 0 ? 'Sin entrenar' : `${tomas} ${tomas === 1 ? 'toma' : 'tomas'}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        );
      })}
    </Pantalla>
  );
}

/** Cuenta atrás y estímulo visual mientras el casco registra. */
function Toma({ opcion, fase }: { opcion: Opcion; fase: Fase }) {
  const [restante, setRestante] = useState(DURACION_TOMA_S);
  const tomando = fase === 'tomando';

  useEffect(() => {
    if (!tomando) return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      setRestante(Math.max(0, DURACION_TOMA_S - Math.floor((Date.now() - inicio) / 1000)));
    }, 250);
    return () => clearInterval(intervalo);
  }, [tomando]);

  const instruccion =
    opcion.accion === 'neutral'
      ? 'Relájate y no hagas nada'
      : opcion.deteccion === 'mental'
        ? ordenGesto(opcion.accion)
        : `${ordenGesto(opcion.accion)} y mantenlo`;

  return (
    <div className={estilos.toma}>
      <p className={estilos.instruccion} role="status">
        {fase === 'pidiendo' ? 'Preparando…' : tomando ? instruccion : 'Toma terminada'}
      </p>
      {opcion.deteccion === 'mental' && (
        <div className={estilos.escena} aria-hidden="true">
          <span className={estilos.cubo} data-mover={tomando && opcion.accion === 'push'} />
        </div>
      )}
      {tomando && (
        <Medidor
          valor={restante / DURACION_TOMA_S}
          etiqueta="Tiempo restante de la toma"
          tamano={120}
        >
          {restante}
        </Medidor>
      )}
    </div>
  );
}
