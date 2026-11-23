// Barra flotante (docs/pantallas.md §4.10): ventana pequeña (~640 × 72 px) siempre visible que
// abre el motor con pywebview. Muestra el modo, el último gesto, la batería y los avisos críticos
// mientras la persona usa otros programas con el cursor.
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Bateria,
  BATERIA_BAJA,
  BotonGrande,
  IndicadorEstado,
  type TonoIndicador,
} from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useMotor, type EstadoMotor } from '../../estado/motor';
import { pedirModo } from '../../estado/ordenes';
import { CONTACTO_MINIMO } from '../../estructura/resumen';
import { nombreGesto, NOMBRE_ACCION } from '../../textos';
import estilos from './BarraFlotante.module.css';

const DURACION_GESTO_MS = 3000;

interface Resumen {
  tono: TonoIndicador;
  texto: string;
}

/** Lo más importante que hay que decir ahora, de más a menos grave. */
function resumenBarra(s: EstadoMotor): Resumen {
  if (s.enlace.estado !== 'abierto' || !s.estado) return { tono: 'mal', texto: 'Sin conexión' };
  const { conexion, modo } = s.estado;
  if (conexion.estado === 'error') return { tono: 'mal', texto: 'Sin casco' };
  if (conexion.estado !== 'conectado') return { tono: 'apagado', texto: 'Buscando el casco…' };
  if ((s.dispositivo?.calidad_global ?? 100) < CONTACTO_MINIMO) {
    return { tono: 'mal', texto: 'Mal contacto' };
  }
  switch (modo) {
    case 'cursor':
      return { tono: 'bien', texto: 'Cursor activo' };
    case 'pausa':
      return { tono: 'aviso', texto: 'En pausa' };
    case 'comunicador':
      return { tono: 'apagado', texto: 'Cursor bloqueado: comunicador' };
    case 'calibrando':
      return { tono: 'aviso', texto: 'Calibrando' };
    case 'entrenando':
      return { tono: 'aviso', texto: 'Entrenando' };
    default:
      return { tono: 'apagado', texto: 'Sin casco' };
  }
}

export function BarraFlotante() {
  const resumen = useMotor(useShallow(resumenBarra));
  const modo = useMotor((s) => s.estado?.modo);
  const bateria = useMotor((s) =>
    s.estado?.conexion.estado === 'conectado' ? (s.dispositivo?.bateria_pct ?? null) : null,
  );
  const accion = useMotor((s) => s.accion);
  const gesto = useMotor((s) => s.gesto);
  const ultimo = accion && (!gesto || accion.t >= gesto.t) ? accion : gesto;
  const [visto, setVisto] = useState<object | null>(null);

  useEffect(() => {
    document.title = 'NeuroAcceso — barra';
    document.documentElement.dataset['ventana'] = 'barra';
  }, []);

  useEffect(() => {
    if (!ultimo) return;
    const id = setTimeout(() => setVisto(ultimo), DURACION_GESTO_MS);
    return () => clearTimeout(id);
  }, [ultimo]);

  const textoGesto =
    ultimo && ultimo !== visto
      ? 'accion' in ultimo
        ? `${nombreGesto(ultimo.origen.nombre)} → ${NOMBRE_ACCION[ultimo.accion]}`
        : nombreGesto(ultimo.gesto)
      : null;

  const usuario = modo === 'cursor' || modo === 'pausa' || modo === 'comunicador';
  const ordenar = (destino: 'cursor' | 'pausa' | 'comunicador') =>
    pedirModo(destino).catch(avisarError);

  return (
    <main className={estilos.barra} data-tono={resumen.tono}>
      <h1 className="solo-lectores">Barra de NeuroAcceso</h1>
      <p className={estilos.modo} role="status" aria-label="Estado">
        <IndicadorEstado tono={resumen.tono} destacado>
          {resumen.texto}
        </IndicadorEstado>
      </p>
      <p className={estilos.gesto} aria-live="polite" aria-label="Último gesto">
        {textoGesto}
      </p>
      {bateria !== null && (
        <Bateria
          porcentaje={bateria}
          className={bateria < BATERIA_BAJA ? estilos.bateriaBaja : estilos.bateria}
        />
      )}
      <div className={estilos.botones}>
        <BotonGrande
          variante="principal"
          icono="hablar"
          disabled={!usuario || modo === 'comunicador'}
          onClick={() => ordenar('comunicador')}
        >
          Hablar
        </BotonGrande>
        <BotonGrande
          icono={modo === 'pausa' ? 'reanudar' : 'pausa'}
          disabled={modo !== 'cursor' && modo !== 'pausa'}
          onClick={() => ordenar(modo === 'pausa' ? 'cursor' : 'pausa')}
        >
          {modo === 'pausa' ? 'Reanudar' : 'Pausa'}
        </BotonGrande>
      </div>
    </main>
  );
}
