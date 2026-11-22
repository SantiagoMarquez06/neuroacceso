import { SENSORES, type Sensor } from '../api/tipos';
import { NOMBRE_CONTACTO, nivelContacto, ZONA_SENSOR, type NivelContacto } from '../textos';
import estilos from './MapaSensores.module.css';

/** Posición de cada sensor vista desde arriba (nariz hacia arriba), en un lienzo de 200 × 224. */
const POSICION: Record<Sensor, [x: number, y: number]> = {
  AF3: [72, 54],
  AF4: [128, 54],
  F7: [38, 82],
  F3: [77, 88],
  F4: [123, 88],
  F8: [162, 82],
  FC5: [50, 114],
  FC6: [150, 114],
  T7: [24, 132],
  T8: [176, 132],
  P7: [42, 170],
  P8: [158, 170],
  O1: [78, 196],
  O2: [122, 196],
};

const LEYENDA: NivelContacto[] = ['bueno', 'regular', 'malo', 'sin_senal'];

interface PropsMapaSensores {
  /** Calidad de contacto por sensor (0–4), o `null` si no hay datos del casco. */
  contacto: Record<string, number> | null;
  className?: string;
}

/**
 * Los 14 sensores del EPOC X sobre la cabeza. Cada nivel de contacto se distingue por color Y
 * por forma (relleno, anillo o trazo discontinuo), y hay una lista equivalente en texto.
 */
export function MapaSensores({ contacto, className }: PropsMapaSensores) {
  return (
    <figure className={[estilos.mapa, className].filter(Boolean).join(' ')}>
      <svg
        className={estilos.cabeza}
        viewBox="0 0 200 224"
        role="img"
        aria-label="Mapa de los sensores del casco, visto desde arriba con la nariz hacia arriba"
      >
        <path className={estilos.contorno} d="M88 26 100 8l12 18" />
        <path className={estilos.contorno} d="M9 108c-9 4-9 28 0 32M191 108c9 4 9 28 0 32" />
        <ellipse className={estilos.contorno} cx="100" cy="122" rx="91" ry="97" />
        {SENSORES.map((sensor) => {
          const [x, y] = POSICION[sensor];
          const nivel = contacto ? nivelContacto(contacto[sensor]) : 'sin_senal';
          return (
            <g key={sensor} className={estilos[nivel]} data-sensor={sensor} data-nivel={nivel}>
              {nivel === 'malo' && <circle className={estilos.alarma} cx={x} cy={y} r="18" />}
              <circle className={estilos.punto} cx={x} cy={y} r="13.5" />
              <text className={estilos.nombre} x={x} y={y + 3.5} textAnchor="middle">
                {sensor}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption>
        <ul className={estilos.leyenda} aria-label="Leyenda">
          {LEYENDA.map((nivel) => (
            <li key={nivel} className={estilos[nivel]}>
              <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
                {nivel === 'malo' && <circle className={estilos.alarma} cx="18" cy="18" r="16" />}
                <circle className={estilos.punto} cx="18" cy="18" r="11" />
              </svg>
              {NOMBRE_CONTACTO[nivel]}
            </li>
          ))}
        </ul>
        {/* Equivalente en texto del mapa, sensor por sensor. */}
        <ul className="solo-lectores">
          {SENSORES.map((sensor) => (
            <li key={sensor}>
              {sensor}, {ZONA_SENSOR[sensor]}:{' '}
              {NOMBRE_CONTACTO[contacto ? nivelContacto(contacto[sensor]) : 'sin_senal']}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
