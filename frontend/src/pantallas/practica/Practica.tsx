// Práctica de puntería (docs/pantallas.md §4.5, ISO 9241-411). La interfaz mide cada intento con
// los clics del DOM (el motor es quien mueve el cursor y hace clic) y el motor calcula las métricas.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { useSesiones } from '../../api/consultas';
import { api } from '../../api/rest';
import type { Sesion } from '../../api/tipos';
import { Aviso, BotonGrande, Selector, Tarjeta } from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useMotor } from '../../estado/motor';
import { Pantalla } from '../../estructura/Pantalla';
import { formatoNumero, formatoPorcentaje } from '../../textos';
import {
  amplitudPara,
  BLOQUES_PROTOCOLO,
  objetivoDe,
  OBJETIVOS_POR_DEFECTO,
  posiciones,
  RECORRIDO_INICIAL,
  registrarClic,
  type Recorrido,
  type Tarea,
} from './iso';
import estilos from './Practica.module.css';

type Fase =
  | { tipo: 'inicio' }
  | { tipo: 'bloque'; bloque: number; tarea: Tarea | null; recorrido: Recorrido }
  | { tipo: 'pausa'; bloque: number }
  | { tipo: 'enviando' }
  | { tipo: 'resultados'; sesion: Sesion };

/** Tamaño del área si el navegador no la mide (p. ej. en pruebas). */
const AREA_MINIMA = { ancho: 800, alto: 520 };

export function Practica() {
  const consultas = useQueryClient();
  const perfilId = useMotor((s) => s.estado?.perfil_activo_id ?? null);
  const modo = useMotor((s) => s.estado?.modo);
  const [n, setN] = useState(OBJETIVOS_POR_DEFECTO);
  const [fase, setFase] = useState<Fase>({ tipo: 'inicio' });
  const area = useRef<HTMLDivElement>(null);
  const sesion = useRef<string | null>(null);
  const totalIntentos = useRef(0);
  const bloques = BLOQUES_PROTOCOLO;

  // Si se sale a mitad, la sesión se cierra con lo que haya (el motor calcula con eso).
  useEffect(
    () => () => {
      if (sesion.current) api.sesiones.finalizar(sesion.current).catch(() => undefined);
    },
    [],
  );

  /** Muestra el área del bloque; su geometría se calcula en cuanto se ve (ver abajo). */
  const prepararBloque = (bloque: number) =>
    setFase({ tipo: 'bloque', bloque, tarea: null, recorrido: RECORRIDO_INICIAL });

  // El área solo se puede medir cuando está a la vista: se mide antes de pintar los objetivos.
  const pendiente = fase.tipo === 'bloque' && fase.tarea === null ? fase.bloque : null;
  useLayoutEffect(() => {
    if (pendiente === null) return;
    const rect = area.current?.getBoundingClientRect();
    const medida = {
      ancho: rect?.width || AREA_MINIMA.ancho,
      alto: rect?.height || AREA_MINIMA.alto,
    };
    const anchoMaximo = Math.max(...bloques.map((b) => b.ancho));
    const tarea: Tarea = {
      n,
      amplitud: amplitudPara(medida, anchoMaximo),
      ancho: bloques[pendiente]!.ancho,
      centro: { x: medida.ancho / 2, y: medida.alto / 2 },
      desde: totalIntentos.current,
      dpr: window.devicePixelRatio || 1,
    };
    // Medir el DOM y guardar el resultado es justo el uso previsto de un efecto de diseño.
    setFase({ tipo: 'bloque', bloque: pendiente, tarea, recorrido: RECORRIDO_INICIAL });
  }, [pendiente, n, bloques]);

  const iniciar = async () => {
    try {
      sesion.current = (await api.sesiones.crear('practica')).id;
      totalIntentos.current = 0;
      prepararBloque(0);
    } catch (error) {
      avisarError(error);
    }
  };

  const terminarBloque = async (bloque: number, intentos: Recorrido['intentos']) => {
    const id = sesion.current;
    if (!id) return;
    setFase({ tipo: 'enviando' });
    try {
      await api.sesiones.agregarIntentos(id, intentos);
      totalIntentos.current += intentos.length;
      if (bloque + 1 < bloques.length) {
        setFase({ tipo: 'pausa', bloque: bloque + 1 });
        return;
      }
      const final = await api.sesiones.finalizar(id);
      sesion.current = null;
      await consultas.invalidateQueries({ queryKey: ['sesiones'] });
      setFase({ tipo: 'resultados', sesion: final });
    } catch (error) {
      avisarError(error);
      setFase({ tipo: 'pausa', bloque }); // se puede repetir el bloque
    }
  };

  const alPulsar = (evento: PointerEvent<HTMLDivElement>) => {
    if (fase.tipo !== 'bloque' || !fase.tarea || !area.current) return;
    const rect = area.current.getBoundingClientRect();
    const clic = {
      x: Number((evento.clientX - rect.left).toFixed(1)),
      y: Number((evento.clientY - rect.top).toFixed(1)),
    };
    const { recorrido, terminado } = registrarClic(
      fase.tarea,
      fase.recorrido,
      clic,
      performance.now(),
    );
    if (terminado) void terminarBloque(fase.bloque, recorrido.intentos);
    else setFase({ ...fase, recorrido });
  };

  const detener = () => {
    const id = sesion.current;
    sesion.current = null;
    if (id) api.sesiones.finalizar(id).catch(() => undefined);
    setFase({ tipo: 'inicio' });
  };

  const enCurso = fase.tipo === 'bloque';
  const marcador =
    fase.tipo === 'bloque' && fase.tarea
      ? (() => {
          const { recorrido } = fase;
          const tarea = fase.tarea!;
          const aciertos = recorrido.intentos.filter((i) => i.acierto).length;
          return recorrido.paso === 0
            ? `Bloque ${fase.bloque + 1} de ${bloques.length} · Pulsa el objetivo marcado para empezar`
            : `Bloque ${fase.bloque + 1} de ${bloques.length} · Objetivo ${recorrido.paso} de ${tarea.n} · Aciertos ${aciertos} · Fallos ${recorrido.intentos.length - aciertos}`;
        })()
      : null;

  return (
    <Pantalla
      titulo="Práctica de puntería"
      descripcion={
        fase.tipo === 'inicio'
          ? 'Lleva el cursor con la cabeza al círculo marcado y haz clic con el gesto. Mide la precisión y la velocidad.'
          : undefined
      }
      acciones={
        enCurso && (
          <BotonGrande icono="cerrar" onClick={detener}>
            Detener
          </BotonGrande>
        )
      }
    >
      {fase.tipo === 'inicio' && (
        <Tarjeta titulo="Antes de empezar" nivel={2}>
          {!perfilId && <Aviso tono="aviso" titulo="Elige un perfil para guardar los resultados" />}
          {modo !== 'cursor' && perfilId && (
            <Aviso tono="aviso" titulo="El cursor no está activo">
              Para hacer la práctica con el casco, el cursor debe estar activo (no en pausa).
            </Aviso>
          )}
          <Selector
            etiqueta="Objetivos por bloque"
            valor={String(n)}
            opciones={['9', '13', '15', '21'].map((v) => ({ valor: v, texto: `${v} objetivos` }))}
            onCambio={(v) => setN(Number(v))}
            ayuda={`${bloques.length} bloques: objetivos de ${bloques.map((b) => `${b.ancho} px`).join(' y de ')}.`}
          />
          <div>
            <BotonGrande
              variante="principal"
              tamano="grande"
              icono="reanudar"
              disabled={!perfilId}
              onClick={() => void iniciar()}
            >
              Iniciar
            </BotonGrande>
          </div>
        </Tarjeta>
      )}

      {fase.tipo === 'pausa' && (
        <Tarjeta titulo={`Bloque ${fase.bloque} terminado`} nivel={2}>
          <p>
            Descansa si lo necesitas. En el siguiente bloque los objetivos son de{' '}
            {bloques[fase.bloque]!.ancho} px.
          </p>
          <div>
            <BotonGrande
              variante="principal"
              tamano="grande"
              icono="siguiente"
              onClick={() => prepararBloque(fase.bloque)}
            >
              Continuar
            </BotonGrande>
          </div>
        </Tarjeta>
      )}

      {fase.tipo === 'enviando' && <p role="status">Guardando los resultados…</p>}

      {fase.tipo === 'resultados' && (
        <Resultados
          sesion={fase.sesion}
          perfilId={perfilId}
          onRepetir={() => setFase({ tipo: 'inicio' })}
        />
      )}

      {/* El área existe siempre para poder medirla antes del primer bloque. */}
      <div
        ref={area}
        className={estilos.area}
        hidden={!enCurso}
        onPointerDown={alPulsar}
        role="application"
        aria-label="Área de la práctica"
      >
        {fase.tipo === 'bloque' && fase.tarea && (
          <>
            <p className={estilos.marcador} role="status">
              {marcador}
            </p>
            <Objetivos tarea={fase.tarea} paso={fase.recorrido.paso} />
          </>
        )}
      </div>
    </Pantalla>
  );
}

function Objetivos({ tarea, paso }: { tarea: Tarea; paso: number }) {
  const activo = objetivoDe(tarea, paso);
  return posiciones(tarea.n, tarea.amplitud, tarea.centro).map((p, i) => {
    const esActivo = activo.x === p.x && activo.y === p.y;
    return (
      <span
        key={i}
        className={esActivo ? estilos.objetivoActivo : estilos.objetivo}
        data-activo={esActivo || undefined}
        style={{
          left: p.x - tarea.ancho / 2,
          top: p.y - tarea.ancho / 2,
          width: tarea.ancho,
          height: tarea.ancho,
        }}
      />
    );
  });
}

interface PropsResultados {
  sesion: Sesion;
  perfilId: string | null;
  onRepetir: () => void;
}

function Resultados({ sesion, perfilId, onRepetir }: PropsResultados) {
  const historial = useSesiones({ perfil_id: perfilId ?? undefined }, perfilId !== null);
  const anterior = historial.data?.find(
    (s) =>
      s.tipo === 'practica' &&
      s.id !== sesion.id &&
      s.metricas?.throughput_bps != null &&
      s.inicio <= sesion.inicio,
  );
  const m = sesion.metricas;

  const comparar = (
    actual: number | null | undefined,
    previo: number | null | undefined,
    unidad: string,
    decimales: number,
    mayorEsMejor = true,
  ) => {
    if (actual == null || previo == null) return null;
    const delta = actual - previo;
    if (Math.abs(delta) < 10 ** -decimales / 2) return 'Igual que la vez anterior';
    const mejor = mayorEsMejor ? delta > 0 : delta < 0;
    return `${delta > 0 ? '+' : '−'}${formatoNumero(Math.abs(delta), decimales)}${unidad} respecto a la vez anterior (${mejor ? 'mejor' : 'peor'})`;
  };

  const filas = [
    {
      nombre: 'Rendimiento',
      valor: m?.throughput_bps == null ? '—' : `${formatoNumero(m.throughput_bps, 2)} bits/s`,
      ayuda: 'Combina velocidad y precisión (ISO 9241-411). Más es mejor.',
      cambio: comparar(m?.throughput_bps, anterior?.metricas?.throughput_bps, ' bits/s', 2),
    },
    {
      nombre: 'Precisión',
      valor: formatoPorcentaje(m?.precision),
      ayuda: 'Clics dentro del objetivo.',
      cambio: comparar(
        m?.precision == null ? null : m.precision * 100,
        anterior?.metricas?.precision == null ? null : anterior.metricas.precision * 100,
        ' puntos',
        0,
      ),
    },
    {
      nombre: 'Tiempo medio por objetivo',
      valor: m?.tiempo_medio_ms == null ? '—' : `${formatoNumero(m.tiempo_medio_ms / 1000, 2)} s`,
      ayuda: 'Menos es mejor.',
      cambio: comparar(
        m?.tiempo_medio_ms == null ? null : m.tiempo_medio_ms / 1000,
        anterior?.metricas?.tiempo_medio_ms == null
          ? null
          : anterior.metricas.tiempo_medio_ms / 1000,
        ' s',
        2,
        false,
      ),
    },
    {
      nombre: 'Clics fuera por minuto',
      valor: formatoNumero(m?.falsos_positivos_min, 1),
      ayuda: 'Menos es mejor.',
      cambio: comparar(
        m?.falsos_positivos_min,
        anterior?.metricas?.falsos_positivos_min,
        '',
        1,
        false,
      ),
    },
  ];

  return (
    <Tarjeta titulo="Resultados" nivel={2}>
      <dl className={estilos.metricas}>
        {filas.map((f) => (
          <div key={f.nombre} className={estilos.metrica}>
            <dt>{f.nombre}</dt>
            <dd className={`${estilos.valor} numeros`}>{f.valor}</dd>
            <dd className={estilos.ayuda}>{f.cambio ?? f.ayuda}</dd>
          </div>
        ))}
      </dl>
      {!anterior && historial.isSuccess && (
        <p className={estilos.ayuda}>Es la primera práctica de este perfil.</p>
      )}
      <div>
        <BotonGrande variante="principal" icono="reintentar" onClick={onRepetir}>
          Hacer otra práctica
        </BotonGrande>
      </div>
    </Tarjeta>
  );
}
