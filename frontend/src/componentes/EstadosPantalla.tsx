// Estados que toda pantalla debe manejar: cargando, vacío y error (docs/pantallas.md §3.2).
// Nunca una pantalla en blanco, nunca un JSON ni un rastro de error.
import type { ReactNode } from 'react';
import { textoDeError } from '../estado/avisos';
import { BotonGrande } from './BotonGrande';
import estilos from './EstadosPantalla.module.css';
import { Icono, type NombreIcono } from './Icono';

interface PropsCargando {
  /** Qué se está esperando ("Cargando perfiles…"). */
  texto?: string;
}

export function Cargando({ texto = 'Cargando…' }: PropsCargando) {
  return (
    <div className={estilos.estado} role="status">
      <span className={estilos.giro} aria-hidden="true" />
      <p className={estilos.titulo}>{texto}</p>
    </div>
  );
}

interface PropsVacio {
  icono?: NombreIcono;
  titulo: string;
  /** Explicación de qué aparecerá aquí y cómo empezar. */
  children?: ReactNode;
  /** Botón para crear lo primero. */
  accion?: ReactNode;
}

export function Vacio({ icono = 'casco', titulo, children, accion }: PropsVacio) {
  return (
    <div className={estilos.estado}>
      <Icono nombre={icono} tamano="3.5rem" className={estilos.icono} />
      <p className={estilos.titulo}>{titulo}</p>
      {children && <div className={estilos.detalle}>{children}</div>}
      {accion}
    </div>
  );
}

interface PropsErrorPantalla {
  /** El error atrapado; se traduce a un mensaje claro según su código. */
  error: unknown;
  onReintentar?: () => void;
}

export function ErrorPantalla({ error, onReintentar }: PropsErrorPantalla) {
  const { titulo, ayuda } = textoDeError(error);
  return (
    <div className={estilos.estado} role="alert">
      <Icono nombre="alerta" tamano="3.5rem" className={estilos.iconoMal} />
      <p className={estilos.titulo}>{titulo}</p>
      <p className={estilos.detalle}>{ayuda}</p>
      {onReintentar && (
        <BotonGrande variante="principal" icono="reintentar" onClick={onReintentar}>
          Reintentar
        </BotonGrande>
      )}
    </div>
  );
}
