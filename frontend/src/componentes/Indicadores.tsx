// Indicadores de estado: punto + texto, batería y progreso.
import type { ReactNode } from 'react';
import estilos from './Indicadores.module.css';

export type TonoIndicador = 'bien' | 'aviso' | 'mal' | 'apagado' | 'accion';

/** Cada tono tiene su FORMA además de su color: el color nunca es la única señal. */
const FORMAS: Record<TonoIndicador, ReactNode> = {
  bien: <circle cx="8" cy="8" r="6.5" fill="currentColor" />,
  accion: <circle cx="8" cy="8" r="6.5" fill="currentColor" />,
  aviso: <path d="M8 1.5 15 14H1z" fill="currentColor" />,
  mal: <rect x="2" y="2" width="12" height="12" rx="1.5" fill="currentColor" />,
  apagado: <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="2.5" />,
};

interface PropsIndicadorEstado {
  tono: TonoIndicador;
  children: ReactNode;
  /** Texto más grande, para la barra superior y la barra flotante. */
  destacado?: boolean;
  className?: string;
}

/** Marca de color y forma + texto. Ej.: ● Conectado · ▲ Batería baja · ■ Mal contacto. */
export function IndicadorEstado({ tono, children, destacado, className }: PropsIndicadorEstado) {
  const clases = [estilos.indicador, estilos[tono], destacado && estilos.destacado, className];
  return (
    <span className={clases.filter(Boolean).join(' ')} data-tono={tono}>
      <svg className={estilos.marca} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        {FORMAS[tono]}
      </svg>
      <span>{children}</span>
    </span>
  );
}

export const BATERIA_BAJA = 20;

interface PropsBateria {
  /** 0–100, o `null` si aún no se sabe. */
  porcentaje: number | null;
  className?: string;
}

export function Bateria({ porcentaje, className }: PropsBateria) {
  const baja = porcentaje !== null && porcentaje < BATERIA_BAJA;
  const texto =
    porcentaje === null ? 'Batería: sin datos' : `Batería ${porcentaje} %${baja ? ' (baja)' : ''}`;
  return (
    <span
      className={[estilos.bateria, baja && estilos.bateriaBaja, className]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={texto}
    >
      <svg className={estilos.pila} viewBox="0 0 34 18" aria-hidden="true" focusable="false">
        <rect
          x="1"
          y="1"
          width="28"
          height="16"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="30.5" y="6" width="3" height="6" rx="1" fill="currentColor" />
        {porcentaje !== null && (
          <rect
            x="4"
            y="4"
            width={Math.max(2, (22 * Math.min(100, Math.max(0, porcentaje))) / 100)}
            height="10"
            rx="1.5"
            fill="currentColor"
          />
        )}
      </svg>
      <span className="numeros" aria-hidden="true">
        {porcentaje === null ? '—' : `${porcentaje} %`}
      </span>
    </span>
  );
}

interface PropsMedidor {
  /** Progreso de 0 a 1. */
  valor: number;
  /** Qué se está midiendo (para lectores de pantalla). */
  etiqueta: string;
  /** Texto del centro; por defecto, el porcentaje. */
  children?: ReactNode;
  /** Diámetro en píxeles. */
  tamano?: number;
  tono?: TonoIndicador;
}

/** Progreso circular: calibración, cuenta atrás del entrenamiento, calidad de contacto. */
export function Medidor({
  valor,
  etiqueta,
  children,
  tamano = 140,
  tono = 'accion',
}: PropsMedidor) {
  const acotado = Math.min(1, Math.max(0, valor));
  const radio = 44;
  const perimetro = 2 * Math.PI * radio;
  return (
    <div
      className={[estilos.medidor, estilos[tono]].join(' ')}
      style={{ width: tamano, height: tamano }}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(acotado * 100)}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={estilos.pista} cx="50" cy="50" r={radio} />
        <circle
          className={estilos.avance}
          cx="50"
          cy="50"
          r={radio}
          strokeDasharray={perimetro}
          strokeDashoffset={perimetro * (1 - acotado)}
        />
      </svg>
      <span className={`${estilos.centro} numeros`}>
        {children ?? `${Math.round(acotado * 100)} %`}
      </span>
    </div>
  );
}

interface PropsBarraProgreso {
  valor: number;
  etiqueta: string;
  tono?: TonoIndicador;
}

/** Progreso lineal. */
export function BarraProgreso({ valor, etiqueta, tono = 'accion' }: PropsBarraProgreso) {
  const acotado = Math.min(1, Math.max(0, valor));
  return (
    <div
      className={[estilos.barra, estilos[tono]].join(' ')}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(acotado * 100)}
    >
      <div className={estilos.barraAvance} style={{ width: `${acotado * 100}%` }} />
    </div>
  );
}
