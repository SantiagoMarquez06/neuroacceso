// Iconos de línea propios (sin dependencias ni internet). Siempre acompañan a un texto:
// son decorativos y los lectores de pantalla los ignoran.
import type { ReactNode } from 'react';

const TRAZOS = {
  inicio: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
    </>
  ),
  hablar: <path d="M4 5h16v11H10l-6 4.5z" />,
  practica: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  entrenar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.5 12H9l1.5-4 3 8 1.5-4h2.5" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </>
  ),
  historial: <path d="M4 4v16h16M8.5 16v-4M12.5 16V8M16.5 16v-6" />,
  perfil: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  casco: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M4 14h3v6H4zM17 14h3v6h-3z" />
    </>
  ),
  cursor: <path d="M5 3l14 8-6.5 2L10 19.5z" />,
  pausa: <path d="M8 5v14M16 5v14" />,
  reanudar: <path d="M7 5l12 7-12 7z" />,
  volver: <path d="M19 12H5M11 6l-6 6 6 6" />,
  siguiente: <path d="M5 12h14M13 6l6 6-6 6" />,
  arriba: <path d="M12 19V5M6 11l6-6 6 6" />,
  abajo: <path d="M12 5v14M6 13l6 6 6-6" />,
  bien: <path d="M5 12.5 10 17.5 19 7" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  alerta: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2v.3" />
    </>
  ),
  voz: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </>
  ),
  borrar: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  editar: <path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z" />,
  descargar: <path d="M12 4v11M7 11l5 5 5-5M4 20h16" />,
  reintentar: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  desarrollo: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  encuesta: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof TRAZOS;

interface PropsIcono {
  nombre: NombreIcono;
  /** Lado en unidades CSS; por defecto escala con el texto que lo rodea. */
  tamano?: string;
  className?: string;
}

export function Icono({ nombre, tamano = '1.4em', className }: PropsIcono) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
