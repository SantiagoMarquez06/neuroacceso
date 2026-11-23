// Gráfica de una métrica a lo largo del tiempo: UNA serie, UN eje (nunca dos escalas en la misma
// gráfica: cada métrica va en la suya). El título nombra la serie, así que no lleva leyenda.
// El color es --accion, con contraste ≥ 3:1 sobre las superficies de los dos temas.
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import estilos from './Historial.module.css';

export interface PuntoGrafica {
  /** ms desde epoch */
  t: number;
  valor: number;
}

interface PropsGrafica {
  titulo: string;
  puntos: PuntoGrafica[];
  formato: (valor: number) => string;
  /** Texto de ayuda bajo el título ("Más es mejor"). */
  ayuda?: string;
}

const FECHA = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit' });
const FECHA_LARGA = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function Grafica({ titulo, puntos, formato, ayuda }: PropsGrafica) {
  return (
    <figure className={estilos.grafica}>
      <figcaption>
        <span className={estilos.graficaTitulo}>{titulo}</span>
        {ayuda && <span className={estilos.nota}> · {ayuda}</span>}
      </figcaption>
      {puntos.length < 2 ? (
        <p className={estilos.nota}>Hacen falta al menos dos sesiones para ver la evolución.</p>
      ) : (
        <div
          className={estilos.lienzo}
          role="img"
          aria-label={`${titulo}: ${puntos.length} sesiones, de ${formato(puntos[0]!.valor)} a ${formato(puntos.at(-1)!.valor)}. Los valores exactos están en la tabla.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={puntos} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--linea-suave)" strokeWidth={1} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => FECHA.format(t)}
                stroke="var(--texto-suave)"
                tick={{ fill: 'var(--texto-suave)', fontSize: 14 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--linea-suave)' }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formato}
                tick={{ fill: 'var(--texto-suave)', fontSize: 14 }}
                tickLine={false}
                axisLine={false}
                width={72}
                domain={[0, 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'var(--linea)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'var(--superficie-2)',
                  border: '2px solid var(--linea)',
                  borderRadius: 8,
                  color: 'var(--texto)',
                }}
                labelStyle={{ color: 'var(--texto-suave)' }}
                itemStyle={{ color: 'var(--texto)' }}
                labelFormatter={(t) => FECHA_LARGA.format(Number(t))}
                formatter={(v) => [formato(Number(v)), titulo]}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--accion)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'var(--accion)', stroke: 'var(--superficie)', strokeWidth: 2 }}
                activeDot={{
                  r: 7,
                  fill: 'var(--accion)',
                  stroke: 'var(--superficie)',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  );
}
