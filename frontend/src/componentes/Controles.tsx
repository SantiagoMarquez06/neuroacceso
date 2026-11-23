// Controles de formulario grandes: deslizador, interruptor, selector, campo de texto y pestañas.
import { useId, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { BotonGrande } from './BotonGrande';
import estilos from './Controles.module.css';

// ---- Deslizador ----------------------------------------------------------------------------
interface PropsDeslizador {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onCambio: (valor: number) => void;
  /** Cómo se muestra el valor ("1,2 s", "25"). Por defecto, el número tal cual. */
  formato?: (valor: number) => string;
  /** Explicación breve de qué cambia. */
  ayuda?: string;
  disabled?: boolean;
}

/** Redondea al paso más cercano sin arrastrar errores de coma flotante (0.1 + 0.2). */
function alPaso(valor: number, min: number, max: number, paso: number): number {
  const decimales = (String(paso).split('.')[1] ?? '').length;
  const acotado = Math.min(max, Math.max(min, valor));
  return Number((Math.round((acotado - min) / paso) * paso + min).toFixed(decimales));
}

/**
 * Valor numérico con botones − y + grandes (lo cómodo con el casco) y una barra para arrastrar
 * (lo cómodo con el ratón). El valor actual se ve siempre en grande.
 */
export function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  onCambio,
  formato = String,
  ayuda,
  disabled,
}: PropsDeslizador) {
  const id = useId();
  const cambiar = (nuevo: number) => onCambio(alPaso(nuevo, min, max, paso));
  return (
    <div className={estilos.deslizador}>
      <div className={estilos.cabecera}>
        <label htmlFor={id} className={estilos.etiqueta}>
          {etiqueta}
        </label>
        <output htmlFor={id} className={`${estilos.valor} numeros`}>
          {formato(valor)}
        </output>
      </div>
      <div className={estilos.fila}>
        <BotonGrande
          icono="menos"
          aria-label={`Bajar ${etiqueta}`}
          disabled={disabled || valor <= min}
          onClick={() => cambiar(valor - paso)}
        />
        <input
          id={id}
          className={estilos.barra}
          type="range"
          min={min}
          max={max}
          step={paso}
          value={valor}
          disabled={disabled}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          aria-valuetext={formato(valor)}
          onChange={(evento) => cambiar(Number(evento.target.value))}
        />
        <BotonGrande
          icono="mas"
          aria-label={`Subir ${etiqueta}`}
          disabled={disabled || valor >= max}
          onClick={() => cambiar(valor + paso)}
        />
      </div>
      {ayuda && (
        <p id={`${id}-ayuda`} className={estilos.ayuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

// ---- Interruptor ---------------------------------------------------------------------------
interface PropsInterruptor {
  etiqueta: string;
  activo: boolean;
  onCambio: (activo: boolean) => void;
  ayuda?: string;
  disabled?: boolean;
}

/** Sí / no. Todo el renglón es el objetivo, y el estado se lee en texto además de en color. */
export function Interruptor({ etiqueta, activo, onCambio, ayuda, disabled }: PropsInterruptor) {
  const id = useId();
  return (
    <div className={estilos.campo}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        className={estilos.interruptor}
        disabled={disabled}
        onClick={() => onCambio(!activo)}
      >
        <span className={estilos.etiqueta}>{etiqueta}</span>
        <span className={estilos.estadoInterruptor}>
          <span className={estilos.carril} aria-hidden="true">
            <span className={estilos.perilla} />
          </span>
          <span aria-hidden="true">{activo ? 'Sí' : 'No'}</span>
        </span>
      </button>
      {ayuda && (
        <p id={`${id}-ayuda`} className={estilos.ayuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

// ---- Selector ------------------------------------------------------------------------------
export interface Opcion<T extends string> {
  valor: T;
  texto: string;
}

interface PropsSelector<T extends string> {
  etiqueta: string;
  valor: T;
  opciones: Opcion<T>[];
  onCambio: (valor: T) => void;
  ayuda?: string;
  disabled?: boolean;
}

/** Lista desplegable nativa (accesible con teclado y lector de pantalla), en tamaño grande. */
export function Selector<T extends string>({
  etiqueta,
  valor,
  opciones,
  onCambio,
  ayuda,
  disabled,
}: PropsSelector<T>) {
  const id = useId();
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <select
        id={id}
        className={estilos.entrada}
        value={valor}
        disabled={disabled}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        onChange={(evento) => onCambio(evento.target.value as T)}
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
      {ayuda && (
        <p id={`${id}-ayuda`} className={estilos.ayuda}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

// ---- CampoTexto ----------------------------------------------------------------------------
interface PropsCampoTexto extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  /** Mensaje de error bajo el campo. */
  error?: string;
  ayuda?: string;
}

export function CampoTexto({ etiqueta, valor, onCambio, error, ayuda, ...resto }: PropsCampoTexto) {
  const id = useId();
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.etiqueta}>
        {etiqueta}
      </label>
      <input
        id={id}
        className={estilos.entrada}
        type="text"
        value={valor}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion}
        onChange={(evento) => onCambio(evento.target.value)}
        {...resto}
      />
      {error ? (
        <p id={`${id}-error`} className={estilos.error} role="alert">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className={estilos.ayuda}>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

// ---- Pestanas ------------------------------------------------------------------------------
interface PropsPestanas<T extends string> {
  etiqueta: string;
  pestanas: Opcion<T>[];
  activa: T;
  onCambio: (pestana: T) => void;
  /** Contenido de la pestaña activa. */
  children: ReactNode;
}

/** Pestañas grandes. Con el teclado: flechas para moverse, Inicio y Fin para los extremos. */
export function Pestanas<T extends string>({
  etiqueta,
  pestanas,
  activa,
  onCambio,
  children,
}: PropsPestanas<T>) {
  const base = useId();
  const alTeclear = (evento: KeyboardEvent<HTMLDivElement>) => {
    const actual = pestanas.findIndex((p) => p.valor === activa);
    const destinos: Record<string, number> = {
      ArrowRight: (actual + 1) % pestanas.length,
      ArrowDown: (actual + 1) % pestanas.length,
      ArrowLeft: (actual - 1 + pestanas.length) % pestanas.length,
      ArrowUp: (actual - 1 + pestanas.length) % pestanas.length,
      Home: 0,
      End: pestanas.length - 1,
    };
    const destino = pestanas[destinos[evento.key] ?? -1];
    if (!destino) return;
    evento.preventDefault();
    onCambio(destino.valor);
    document.getElementById(`${base}-${destino.valor}`)?.focus();
  };

  return (
    <div className={estilos.pestanas}>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- el foco va en cada pestaña */}
      <div
        role="tablist"
        aria-label={etiqueta}
        className={estilos.listaPestanas}
        onKeyDown={alTeclear}
      >
        {pestanas.map((pestana) => {
          const seleccionada = pestana.valor === activa;
          return (
            <button
              key={pestana.valor}
              id={`${base}-${pestana.valor}`}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              aria-controls={`${base}-panel`}
              tabIndex={seleccionada ? 0 : -1}
              className={estilos.pestana}
              onClick={() => onCambio(pestana.valor)}
            >
              {pestana.texto}
            </button>
          );
        })}
      </div>
      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-${activa}`}
        className={estilos.panel}
      >
        {children}
      </div>
    </div>
  );
}
