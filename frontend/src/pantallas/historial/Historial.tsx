// Historial e informes (docs/pantallas.md §4.9): evolución del perfil activo, para el acompañante,
// el terapeuta y el informe del proyecto.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { usePerfilActivo, useSesion, useSesiones } from '../../api/consultas';
import { api } from '../../api/rest';
import type { Sesion, TipoSesion } from '../../api/tipos';
import { BotonGrande, Cargando, ErrorPantalla, Selector, Tarjeta, Vacio } from '../../componentes';
import { avisar, avisarError } from '../../estado/avisos';
import { Pantalla } from '../../estructura/Pantalla';
import { formatoFechaHora, formatoNumero, formatoPorcentaje, NOMBRE_SESION } from '../../textos';
import { Grafica, type PuntoGrafica } from './Grafica';
import estilos from './Historial.module.css';
import { desdePeriodo, descargar, resultado, textoDuracion } from './resumen';

type FiltroTipo = TipoSesion | 'todas';

const PERIODOS = [
  { valor: '7', texto: 'Últimos 7 días' },
  { valor: '30', texto: 'Últimos 30 días' },
  { valor: '90', texto: 'Últimos 90 días' },
  { valor: '0', texto: 'Todo' },
];

const TIPOS: { valor: FiltroTipo; texto: string }[] = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'practica', texto: 'Práctica de puntería' },
  { valor: 'comunicador', texto: 'Comunicador' },
  { valor: 'libre', texto: 'Uso libre' },
];

/** Puntos de una métrica, de la sesión más antigua a la más reciente. */
function serie(
  sesiones: Sesion[],
  valor: (s: Sesion) => number | null | undefined,
): PuntoGrafica[] {
  return sesiones
    .flatMap((s) => {
      const v = valor(s);
      return v == null ? [] : [{ t: Date.parse(s.inicio), valor: v }];
    })
    .sort((a, b) => a.t - b.t);
}

export function Historial() {
  const perfil = usePerfilActivo();
  const [periodo, setPeriodo] = useState('30');
  const [tipo, setTipo] = useState<FiltroTipo>('todas');
  // El "desde" se fija al elegir el período: así la consulta no cambia en cada dibujo.
  const [desde, setDesde] = useState(() => desdePeriodo(30));
  const sesiones = useSesiones({ perfil_id: perfil?.id, desde }, perfil !== undefined);
  const [exportando, setExportando] = useState(false);

  if (!perfil) {
    return (
      <Pantalla titulo="Historial">
        <Vacio
          icono="perfil"
          titulo="Elige un perfil para ver su historial"
          accion={<Link to="/">Elegir perfil</Link>}
        />
      </Pantalla>
    );
  }

  const exportar = async () => {
    setExportando(true);
    try {
      const csv = await api.sesiones.exportarCsv(perfil.id);
      const fecha = new Date().toISOString().slice(0, 10);
      descargar(`neuroacceso-${perfil.nombre.replace(/[^\p{L}\p{N}]+/gu, '_')}-${fecha}.csv`, csv);
      avisar({
        tono: 'bien',
        titulo: 'Historial exportado',
        detalle: 'El archivo CSV está en tus descargas.',
      });
    } catch (error) {
      avisarError(error);
    } finally {
      setExportando(false);
    }
  };

  const lista = (sesiones.data ?? []).filter((s) => tipo === 'todas' || s.tipo === tipo);
  const practicas = lista.filter((s) => s.tipo === 'practica' && s.fin);
  const comunicador = lista.filter((s) => s.tipo === 'comunicador' && s.fin);

  return (
    <Pantalla
      titulo={`Historial de ${perfil.nombre}`}
      acciones={
        <BotonGrande icono="descargar" disabled={exportando} onClick={() => void exportar()}>
          Exportar CSV
        </BotonGrande>
      }
    >
      <div className={estilos.filtros}>
        <Selector
          etiqueta="Período"
          valor={periodo}
          opciones={PERIODOS}
          onCambio={(v) => {
            setPeriodo(v);
            setDesde(desdePeriodo(Number(v)));
          }}
        />
        <Selector etiqueta="Tipo de sesión" valor={tipo} opciones={TIPOS} onCambio={setTipo} />
      </div>

      {sesiones.isPending ? (
        <Cargando texto="Cargando sesiones…" />
      ) : sesiones.isError ? (
        <ErrorPantalla error={sesiones.error} onReintentar={() => void sesiones.refetch()} />
      ) : lista.length === 0 ? (
        <Vacio
          icono="historial"
          titulo="No hay sesiones en este período"
          accion={<Link to="/practica">Hacer una práctica de puntería</Link>}
        >
          <p>Cada práctica y cada rato en el comunicador quedan registrados aquí.</p>
        </Vacio>
      ) : (
        <>
          <div className={estilos.graficas}>
            {practicas.length > 0 && (
              <>
                <Grafica
                  titulo="Rendimiento (bits/s)"
                  ayuda="velocidad y precisión juntas; más es mejor"
                  puntos={serie(practicas, (s) => s.metricas?.throughput_bps)}
                  formato={(v) => formatoNumero(v, 1)}
                />
                <Grafica
                  titulo="Aciertos (%)"
                  puntos={serie(practicas, (s) =>
                    s.metricas?.precision == null ? null : s.metricas.precision * 100,
                  )}
                  formato={(v) => `${Math.round(v)} %`}
                />
                <Grafica
                  titulo="Clics fuera por minuto"
                  ayuda="menos es mejor"
                  puntos={serie(practicas, (s) => s.metricas?.falsos_positivos_min)}
                  formato={(v) => formatoNumero(v, 1)}
                />
              </>
            )}
            {comunicador.length > 0 && (
              <Grafica
                titulo="Velocidad de escritura (caracteres/min)"
                puntos={serie(comunicador, (s) => s.metricas?.caracteres_min)}
                formato={(v) => formatoNumero(v, 1)}
              />
            )}
          </div>

          <table className={estilos.tabla}>
            <caption className="solo-lectores">Sesiones</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Duración</th>
                <th scope="col">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/historial/${s.id}`} className={estilos.enlaceFila}>
                      {formatoFechaHora(s.inicio)}
                    </Link>
                  </td>
                  <td>{NOMBRE_SESION[s.tipo]}</td>
                  <td className="numeros">{textoDuracion(s)}</td>
                  <td className="numeros">{resultado(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Pantalla>
  );
}

/** Detalle de una sesión: /historial/:sesionId */
export function DetalleSesion() {
  const { sesionId = '' } = useParams();
  const sesion = useSesion(sesionId);

  if (sesion.isPending) return <Cargando texto="Cargando la sesión…" />;
  if (sesion.isError)
    return <ErrorPantalla error={sesion.error} onReintentar={() => void sesion.refetch()} />;

  const s = sesion.data;
  const m = s.metricas;
  const filas: [string, string][] =
    s.tipo === 'practica'
      ? [
          [
            'Rendimiento',
            m?.throughput_bps == null ? '—' : `${formatoNumero(m.throughput_bps, 2)} bits/s`,
          ],
          ['Aciertos', formatoPorcentaje(m?.precision)],
          [
            'Tiempo medio por objetivo',
            m?.tiempo_medio_ms == null ? '—' : `${formatoNumero(m.tiempo_medio_ms / 1000, 2)} s`,
          ],
          ['Clics fuera por minuto', formatoNumero(m?.falsos_positivos_min, 1)],
        ]
      : s.tipo === 'comunicador'
        ? [
            [
              'Velocidad de escritura',
              m?.caracteres_min == null
                ? '—'
                : `${formatoNumero(m.caracteres_min, 1)} caracteres/min`,
            ],
          ]
        : [];

  return (
    <Pantalla
      titulo={NOMBRE_SESION[s.tipo]}
      descripcion={`${formatoFechaHora(s.inicio)} · ${textoDuracion(s)}`}
      ancho="lectura"
      acciones={
        <Link to="/historial" className={estilos.volver}>
          Volver al historial
        </Link>
      }
    >
      <Tarjeta titulo="Resultados" nivel={2}>
        {filas.length === 0 ? (
          <p className={estilos.nota}>Las sesiones de uso libre no tienen métricas propias.</p>
        ) : (
          <dl className={estilos.metricas}>
            {filas.map(([nombre, valor]) => (
              <div key={nombre}>
                <dt>{nombre}</dt>
                <dd className="numeros">{valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {!s.fin && (
          <p className={estilos.nota}>Esta sesión no se terminó: las métricas pueden faltar.</p>
        )}
      </Tarjeta>
    </Pantalla>
  );
}
