import type { ReactNode } from 'react';
import type { Tono } from '../estado/motor';
import estilos from './Aviso.module.css';
import { Icono, type NombreIcono } from './Icono';

const ICONO: Record<Tono, NombreIcono> = {
  neutro: 'casco',
  bien: 'bien',
  aviso: 'alerta',
  mal: 'alerta',
};

interface PropsAviso {
  tono?: Tono;
  titulo: string;
  /** Qué hacer al respecto. */
  children?: ReactNode;
  /** Botones a la derecha (Reintentar, Cerrar…). */
  acciones?: ReactNode;
  className?: string;
}

/**
 * Mensaje no bloqueante dentro de la página. Los de tono `mal` se anuncian enseguida a los
 * lectores de pantalla; el resto, cuando terminan de hablar.
 */
export function Aviso({ tono = 'neutro', titulo, children, acciones, className }: PropsAviso) {
  return (
    <div
      className={[estilos.caja, estilos[tono], className].filter(Boolean).join(' ')}
      data-tono={tono}
      role={tono === 'mal' ? 'alert' : 'status'}
    >
      <Icono nombre={ICONO[tono]} tamano="2rem" className={estilos.icono} />
      <div className={estilos.texto}>
        <p className={estilos.titulo}>{titulo}</p>
        {children && <div className={estilos.detalle}>{children}</div>}
      </div>
      {acciones && <div className={estilos.acciones}>{acciones}</div>}
    </div>
  );
}
