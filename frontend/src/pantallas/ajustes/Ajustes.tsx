// Ajustes (docs/pantallas.md §4.7). Los cambios se guardan solos medio segundo después de
// tocarlos: el motor los aplica en caliente, así que mover la sensibilidad se nota al instante
// en el cursor (vista previa en vivo) sin buscar un botón "Guardar".
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ajustesPorDefecto } from '../../api/ajustesPorDefecto';
import { CLAVES, useGestosDisponibles } from '../../api/consultas';
import { api } from '../../api/rest';
import type { Accion, Ajustes as TAjustes } from '../../api/tipos';
import {
  Aviso,
  BotonGrande,
  Cargando,
  CampoTexto,
  Deslizador,
  Dialogo,
  ErrorPantalla,
  IndicadorEstado,
  IndicadorOrientacion,
  Interruptor,
  Pestanas,
  Selector,
  Vacio,
} from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useApariencia, type TamanoTexto, type Tema } from '../../estado/apariencia';
import { useMotor } from '../../estado/motor';
import { Pantalla } from '../../estructura/Pantalla';
import { formatoNumero, NOMBRE_ACCION, nombreGesto } from '../../textos';
import { decir, useVoces, vocesLocalesEspanol } from '../../voz/voz';
import estilos from './Ajustes.module.css';
import { ACCIONES_POR_MODO, asignar, revisar } from './validar';

type Seccion = 'cursor' | 'gestos' | 'dwell' | 'comunicador' | 'voz' | 'apariencia';
const SECCIONES: { valor: Seccion; texto: string }[] = [
  { valor: 'cursor', texto: 'Cursor' },
  { valor: 'gestos', texto: 'Gestos' },
  { valor: 'dwell', texto: 'Clic quieto' },
  { valor: 'comunicador', texto: 'Comunicador' },
  { valor: 'voz', texto: 'Voz' },
  { valor: 'apariencia', texto: 'Apariencia' },
];

const ESPERA_GUARDADO_MS = 500;
type EstadoGuardado = 'al_dia' | 'pendiente' | 'guardando' | 'error';

/** Copia modificada de los ajustes. */
function con(a: TAjustes, cambio: (copia: TAjustes) => void): TAjustes {
  const copia = structuredClone(a);
  cambio(copia);
  return copia;
}

export function Ajustes() {
  const perfilId = useMotor((s) => s.estado?.perfil_activo_id ?? null);
  const [seccion, setSeccion] = useState<Seccion>('cursor');

  if (!perfilId) {
    return (
      <Pantalla titulo="Ajustes">
        <Vacio
          icono="perfil"
          titulo="Elige un perfil primero"
          accion={<Link to="/">Elegir perfil</Link>}
        >
          <p>Los ajustes son de cada persona: elige quién va a usar NeuroAcceso.</p>
        </Vacio>
      </Pantalla>
    );
  }
  return <Editor key={perfilId} perfilId={perfilId} seccion={seccion} setSeccion={setSeccion} />;
}

interface PropsEditor {
  perfilId: string;
  seccion: Seccion;
  setSeccion: (s: Seccion) => void;
}

function Editor({ perfilId, seccion, setSeccion }: PropsEditor) {
  const consultas = useQueryClient();
  const guardados = useQuery({
    queryKey: CLAVES.ajustes(perfilId),
    queryFn: () => api.perfiles.ajustes(perfilId),
    staleTime: Infinity,
  });
  const [borrador, setBorrador] = useState<TAjustes | null>(null);
  const [guardado, setGuardado] = useState<EstadoGuardado>('al_dia');
  const [restableciendo, setRestableciendo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendiente = useRef<TAjustes | null>(null);

  const guardar = async (ajustes: TAjustes) => {
    pendiente.current = null;
    setGuardado('guardando');
    try {
      const resultado = await api.perfiles.guardarAjustes(perfilId, ajustes);
      consultas.setQueryData(CLAVES.ajustes(perfilId), resultado);
      setGuardado('al_dia');
    } catch (error) {
      setGuardado('error');
      avisarError(error);
    }
  };

  // Al salir de la pantalla, lo que quedaba por guardar se guarda ya.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      if (pendiente.current)
        void api.perfiles.guardarAjustes(perfilId, pendiente.current).catch(avisarError);
    },
    [perfilId],
  );

  if (guardados.isPending) return <Cargando texto="Cargando ajustes…" />;
  if (guardados.isError) {
    return <ErrorPantalla error={guardados.error} onReintentar={() => void guardados.refetch()} />;
  }

  const ajustes = borrador ?? guardados.data;
  const problemas = revisar(ajustes);

  const cambiar = (nuevo: TAjustes) => {
    setBorrador(nuevo);
    if (temporizador.current) clearTimeout(temporizador.current);
    if (revisar(nuevo).errores.length > 0) {
      pendiente.current = null;
      setGuardado('pendiente');
      return;
    }
    pendiente.current = nuevo;
    setGuardado('pendiente');
    temporizador.current = setTimeout(() => void guardar(nuevo), ESPERA_GUARDADO_MS);
  };

  return (
    <Pantalla
      titulo="Ajustes"
      ancho="lectura"
      acciones={
        <>
          <EstadoDelGuardado estado={guardado} conErrores={problemas.errores.length > 0} />
          <BotonGrande icono="reintentar" onClick={() => setRestableciendo(true)}>
            Restablecer
          </BotonGrande>
        </>
      }
    >
      {problemas.errores.map((e) => (
        <Aviso key={e} tono="mal" titulo="Este cambio no se puede guardar">
          {e}
        </Aviso>
      ))}
      {problemas.avisos.map((a) => (
        <Aviso key={a} tono="aviso" titulo="Revisa los gestos">
          {a}
        </Aviso>
      ))}

      <Pestanas
        etiqueta="Secciones de ajustes"
        pestanas={SECCIONES}
        activa={seccion}
        onCambio={setSeccion}
      >
        {seccion === 'cursor' && <SeccionCursor a={ajustes} cambiar={cambiar} />}
        {seccion === 'gestos' && <SeccionGestos a={ajustes} cambiar={cambiar} />}
        {seccion === 'dwell' && <SeccionDwell a={ajustes} cambiar={cambiar} />}
        {seccion === 'comunicador' && <SeccionComunicador a={ajustes} cambiar={cambiar} />}
        {seccion === 'voz' && <SeccionVoz a={ajustes} cambiar={cambiar} />}
        {seccion === 'apariencia' && <SeccionApariencia />}
      </Pestanas>

      <Dialogo
        abierto={restableciendo}
        titulo="¿Volver a los valores de fábrica?"
        onCerrar={() => setRestableciendo(false)}
        acciones={
          <>
            <BotonGrande data-autofocus onClick={() => setRestableciendo(false)}>
              Cancelar
            </BotonGrande>
            <BotonGrande
              variante="peligro"
              onClick={() => {
                cambiar(ajustesPorDefecto());
                setRestableciendo(false);
              }}
            >
              Restablecer
            </BotonGrande>
          </>
        }
      >
        <p>Se perderán la sensibilidad, los gestos y las frases rápidas de este perfil.</p>
      </Dialogo>
    </Pantalla>
  );
}

function EstadoDelGuardado({
  estado,
  conErrores,
}: {
  estado: EstadoGuardado;
  conErrores: boolean;
}) {
  const [tono, texto] = conErrores
    ? (['mal', 'Sin guardar: revisa los avisos'] as const)
    : estado === 'error'
      ? (['mal', 'No se pudo guardar'] as const)
      : estado === 'al_dia'
        ? (['bien', 'Cambios guardados'] as const)
        : (['aviso', 'Guardando…'] as const);
  return (
    <p role="status" aria-label="Estado del guardado" className={estilos.guardado}>
      <IndicadorEstado tono={tono}>{texto}</IndicadorEstado>
    </p>
  );
}

interface PropsSeccion {
  a: TAjustes;
  cambiar: (nuevo: TAjustes) => void;
}

// ---- Cursor ------------------------------------------------------------------------------------
function SeccionCursor({ a, cambiar }: PropsSeccion) {
  const c = a.cursor;
  return (
    <>
      <div className={estilos.vistaPrevia}>
        <IndicadorOrientacion />
        <p className={estilos.nota}>
          Los cambios se aplican al momento: mueve la cabeza para probar el cursor mientras ajustas.
        </p>
      </div>
      <Deslizador
        etiqueta="Sensibilidad horizontal"
        valor={c.ganancia_x}
        min={1}
        max={100}
        paso={1}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.ganancia_x = v)))}
        ayuda="Cuánto se mueve el cursor al girar la cabeza a los lados."
      />
      <Deslizador
        etiqueta="Sensibilidad vertical"
        valor={c.ganancia_y}
        min={1}
        max={100}
        paso={1}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.ganancia_y = v)))}
        ayuda="Cuánto se mueve el cursor al subir o bajar la cabeza."
      />
      <Deslizador
        etiqueta="Zona quieta"
        valor={c.zona_muerta}
        min={0}
        max={5}
        paso={0.1}
        formato={(v) => `${formatoNumero(v, 1)}°`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.zona_muerta = v)))}
        ayuda="Los movimientos más pequeños que esto no mueven el cursor. Súbela si el cursor tiembla."
      />
      <Deslizador
        etiqueta="Suavizado"
        valor={c.suavizado}
        min={0}
        max={0.95}
        paso={0.05}
        formato={(v) => `${Math.round(v * 100)} %`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.suavizado = v)))}
        ayuda="Más suavizado = movimiento más tranquilo pero con algo de retraso."
      />
      <Interruptor
        etiqueta="Invertir horizontal"
        activo={c.invertir_x}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.invertir_x = v)))}
        ayuda="Actívalo si el cursor va a la izquierda cuando giras a la derecha."
      />
      <Interruptor
        etiqueta="Invertir vertical"
        activo={c.invertir_y}
        onCambio={(v) => cambiar(con(a, (x) => void (x.cursor.invertir_y = v)))}
      />
    </>
  );
}

// ---- Gestos ------------------------------------------------------------------------------------
function SeccionGestos({ a, cambiar }: PropsSeccion) {
  const disponibles = useGestosDisponibles();
  if (disponibles.isPending) return <Cargando texto="Cargando gestos…" />;
  if (disponibles.isError) return <ErrorPantalla error={disponibles.error} />;

  const { ojos, superior, inferior } = disponibles.data.facial;
  const faciales = [...ojos, ...superior, ...inferior];
  const gestos = [...faciales, ...disponibles.data.mental.filter((g) => g === 'push')];
  const opciones = (modo: 'cursor' | 'comunicador') =>
    ACCIONES_POR_MODO[modo].map((accion) => ({ valor: accion, texto: NOMBRE_ACCION[accion] }));

  return (
    <>
      <Selector
        etiqueta="Gesto de rescate"
        valor={a.gestos.gesto_rescate}
        opciones={faciales.map((g) => ({ valor: g, texto: nombreGesto(g) }))}
        onCambio={(g) => cambiar(con(a, (x) => void (x.gestos.gesto_rescate = g)))}
        ayuda="Desde cualquier modo, cambia entre cursor y comunicador. Es la salida de emergencia."
      />
      <Deslizador
        etiqueta="Fuerza mínima del gesto"
        valor={a.gestos.umbral}
        min={0.05}
        max={1}
        paso={0.05}
        formato={(v) => `${Math.round(v * 100)} %`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.gestos.umbral = v)))}
        ayuda="Los gestos más suaves que esto no hacen nada. Súbela si hay acciones que no querías."
      />
      <Deslizador
        etiqueta="Tiempo entre acciones"
        valor={a.gestos.cooldown_ms}
        min={100}
        max={5000}
        paso={100}
        formato={(v) => `${formatoNumero(v / 1000, 1)} s`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.gestos.cooldown_ms = v)))}
        ayuda="Evita que un mismo gesto haga dos acciones seguidas."
      />

      <table className={estilos.tabla}>
        <caption>Qué hace cada gesto</caption>
        <thead>
          <tr>
            <th scope="col">Gesto</th>
            <th scope="col">Con el cursor</th>
            <th scope="col">En el comunicador</th>
          </tr>
        </thead>
        <tbody>
          {gestos.map((gesto) => (
            <tr key={gesto}>
              <th scope="row">{nombreGesto(gesto)}</th>
              {(['cursor', 'comunicador'] as const).map((modo) => (
                <td key={modo}>
                  <label className="solo-lectores" htmlFor={`${gesto}-${modo}`}>
                    {nombreGesto(gesto)} {modo === 'cursor' ? 'con el cursor' : 'en el comunicador'}
                  </label>
                  <select
                    id={`${gesto}-${modo}`}
                    className={estilos.select}
                    value={a.gestos.mapeo[modo][gesto] ?? 'ninguna'}
                    disabled={gesto === a.gestos.gesto_rescate}
                    onChange={(e) => cambiar(asignar(a, modo, gesto, e.target.value as Accion))}
                  >
                    {gesto === a.gestos.gesto_rescate ? (
                      <option value={a.gestos.mapeo[modo][gesto] ?? 'ninguna'}>Rescate</option>
                    ) : (
                      opciones(modo).map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.texto}
                        </option>
                      ))
                    )}
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ---- Clic por permanencia ----------------------------------------------------------------------
function SeccionDwell({ a, cambiar }: PropsSeccion) {
  return (
    <>
      <Interruptor
        etiqueta="Clic al dejar el cursor quieto"
        activo={a.dwell.activo}
        onCambio={(v) => cambiar(con(a, (x) => void (x.dwell.activo = v)))}
        ayuda="Hace clic sin ningún gesto cuando el cursor se queda quieto un momento."
      />
      <Deslizador
        etiqueta="Tiempo quieto"
        valor={a.dwell.ms}
        min={300}
        max={5000}
        paso={100}
        disabled={!a.dwell.activo}
        formato={(v) => `${formatoNumero(v / 1000, 1)} s`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.dwell.ms = v)))}
      />
      <Deslizador
        etiqueta="Margen de movimiento"
        valor={a.dwell.radio_px}
        min={5}
        max={200}
        paso={5}
        disabled={!a.dwell.activo}
        formato={(v) => `${v} px`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.dwell.radio_px = v)))}
        ayuda="Cuánto puede temblar el cursor y seguir contando como quieto."
      />
    </>
  );
}

// ---- Comunicador -------------------------------------------------------------------------------
function SeccionComunicador({ a, cambiar }: PropsSeccion) {
  const [nueva, setNueva] = useState('');
  const frases = a.comunicador.frases;
  const fijarFrases = (lista: string[]) =>
    cambiar(con(a, (x) => void (x.comunicador.frases = lista)));
  const mover = (i: number, delta: number) => {
    const lista = [...frases];
    const [frase] = lista.splice(i, 1);
    lista.splice(i + delta, 0, frase!);
    fijarFrases(lista);
  };

  return (
    <>
      <Deslizador
        etiqueta="Velocidad del barrido"
        valor={a.comunicador.tiempo_barrido_ms}
        min={300}
        max={5000}
        paso={100}
        formato={(v) => `${formatoNumero(v / 1000, 1)} s`}
        onCambio={(v) => cambiar(con(a, (x) => void (x.comunicador.tiempo_barrido_ms = v)))}
        ayuda="Tiempo que se resalta cada opción. Más tiempo = más calma para elegir."
      />
      <Selector
        etiqueta="Orden del teclado"
        valor={a.comunicador.disposicion}
        opciones={[
          { valor: 'abc', texto: 'Alfabético (A B C…)' },
          { valor: 'frecuencia', texto: 'Las letras más usadas primero (E A O S…)' },
        ]}
        onCambio={(v) => cambiar(con(a, (x) => void (x.comunicador.disposicion = v)))}
      />

      <fieldset className={estilos.frases}>
        <legend>Frases rápidas</legend>
        <ol className={estilos.listaFrases}>
          {frases.map((frase, i) => (
            <li key={i}>
              <CampoTexto
                etiqueta={`Frase ${i + 1}`}
                valor={frase}
                maxLength={80}
                onCambio={(v) => fijarFrases(frases.map((f, j) => (j === i ? v : f)))}
              />
              <div className={estilos.botonesFrase}>
                <BotonGrande
                  icono="arriba"
                  aria-label={`Subir «${frase}»`}
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                />
                <BotonGrande
                  icono="abajo"
                  aria-label={`Bajar «${frase}»`}
                  disabled={i === frases.length - 1}
                  onClick={() => mover(i, 1)}
                />
                <BotonGrande
                  variante="peligro"
                  icono="borrar"
                  aria-label={`Borrar «${frase}»`}
                  onClick={() => fijarFrases(frases.filter((_, j) => j !== i))}
                />
              </div>
            </li>
          ))}
        </ol>
        <form
          className={estilos.nuevaFrase}
          onSubmit={(e) => {
            e.preventDefault();
            if (!nueva.trim()) return;
            fijarFrases([...frases, nueva.trim()]);
            setNueva('');
          }}
        >
          <CampoTexto etiqueta="Nueva frase" valor={nueva} onCambio={setNueva} maxLength={80} />
          <BotonGrande type="submit" icono="mas" disabled={!nueva.trim()}>
            Añadir frase
          </BotonGrande>
        </form>
      </fieldset>
    </>
  );
}

// ---- Voz ---------------------------------------------------------------------------------------
function SeccionVoz({ a, cambiar }: PropsSeccion) {
  const voces = vocesLocalesEspanol(useVoces());
  const probar = () =>
    decir('Hola, así sonará mi voz.', { vozId: a.voz.voz_id, velocidad: a.voz.velocidad }).catch(
      (e: unknown) => avisarError(e),
    );
  return (
    <>
      {voces.length === 0 ? (
        <Aviso tono="aviso" titulo="No hay voces en español instaladas en este equipo">
          Se usará la voz de NeuroAcceso. Para elegir una voz, instálala en Configuración de Windows
          → Hora e idioma → Voz.
        </Aviso>
      ) : (
        <Selector
          etiqueta="Voz"
          valor={a.voz.voz_id ?? ''}
          opciones={[
            { valor: '', texto: 'La primera disponible' },
            ...voces.map((v) => ({ valor: v.voiceURI, texto: `${v.name} (${v.lang})` })),
          ]}
          onCambio={(v) => cambiar(con(a, (x) => void (x.voz.voz_id = v || null)))}
          ayuda="Solo aparecen voces instaladas en el equipo: funcionan sin internet."
        />
      )}
      <Deslizador
        etiqueta="Velocidad de la voz"
        valor={a.voz.velocidad}
        min={50}
        max={300}
        paso={10}
        formato={(v) => (v === 150 ? 'Normal' : `${v} palabras/min`)}
        onCambio={(v) => cambiar(con(a, (x) => void (x.voz.velocidad = v)))}
      />
      <div>
        <BotonGrande variante="principal" icono="voz" onClick={() => void probar()}>
          Probar voz
        </BotonGrande>
      </div>
    </>
  );
}

// ---- Apariencia (local de la interfaz) ---------------------------------------------------------
function SeccionApariencia() {
  const { tema, texto, cambiar } = useApariencia();
  return (
    <>
      <p className={estilos.nota}>
        La apariencia se guarda en este equipo, para todos los perfiles.
      </p>
      <Selector<Tema>
        etiqueta="Colores"
        valor={tema}
        opciones={[
          { valor: 'oscuro', texto: 'Oscuro (recomendado)' },
          { valor: 'contraste', texto: 'Alto contraste' },
        ]}
        onCambio={(v) => cambiar({ tema: v })}
      />
      <Selector<TamanoTexto>
        etiqueta="Tamaño del texto"
        valor={texto}
        opciones={[
          { valor: 'normal', texto: 'Normal' },
          { valor: 'grande', texto: 'Grande' },
          { valor: 'muy-grande', texto: 'Muy grande' },
        ]}
        onCambio={(v) => cambiar({ texto: v })}
      />
    </>
  );
}
