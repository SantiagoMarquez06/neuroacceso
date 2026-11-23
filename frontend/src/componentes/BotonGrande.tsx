import type { ButtonHTMLAttributes } from 'react';
import estilos from './BotonGrande.module.css';
import { Icono, type NombreIcono } from './Icono';

export type NivelBarrido = 'grupo' | 'activo';

interface PropsBotonGrande extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'principal' | 'secundario' | 'peligro' | 'fantasma';
  /** `grande` para teclas y acciones principales (88 px). */
  tamano?: 'normal' | 'grande';
  icono?: NombreIcono;
  /** Ocupa todo el ancho disponible. */
  completo?: boolean;
  /** Resaltado del barrido: su grupo está seleccionado, o es el elemento activo. */
  barrido?: NivelBarrido;
}

/**
 * Botón de la interfaz. Mide como mínimo 64 × 64 px: apuntar con la cabeza es impreciso.
 * Lleva siempre texto visible (o `aria-label` si solo tiene icono).
 */
export function BotonGrande({
  variante = 'secundario',
  tamano = 'normal',
  icono,
  completo = false,
  barrido,
  className,
  children,
  type = 'button',
  ...resto
}: PropsBotonGrande) {
  const clases = [
    estilos.boton,
    estilos[variante],
    tamano === 'grande' && estilos.grande,
    completo && estilos.completo,
    !children && estilos.soloIcono,
    barrido === 'grupo' && estilos.barridoGrupo,
    barrido === 'activo' && estilos.barridoActivo,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={clases} data-barrido={barrido} {...resto}>
      {icono && <Icono nombre={icono} />}
      {children}
    </button>
  );
}
