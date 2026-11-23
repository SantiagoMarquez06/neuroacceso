// Inicio — elegir perfil (docs/pantallas.md §4.1).
import { useState } from 'react';
import { Link } from 'react-router';
import { usePerfiles, useSesiones } from '../../api/consultas';
import { Cargando, ErrorPantalla, Icono, IndicadorEstado } from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useMotor } from '../../estado/motor';
import { Pantalla } from '../../estructura/Pantalla';
import { resumenConexion, resumenContacto } from '../../estructura/resumen';
import { haceCuanto } from '../../textos';
import { useShallow } from 'zustand/react/shallow';
import { DialogoNombre } from './DialogoNombre';
import estilos from './Perfiles.module.css';
import { useOrdenesPerfiles } from './usarPerfiles';

export function ElegirPerfil() {
  const perfiles = usePerfiles();
  const sesiones = useSesiones({});
  const activoId = useMotor((s) => s.estado?.perfil_activo_id);
  const conexion = useMotor(useShallow(resumenConexion));
  const contacto = useMotor(useShallow(resumenContacto));
  const ordenes = useOrdenesPerfiles();
  const [creando, setCreando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const activar = async (perfilId: string) => {
    setOcupado(true);
    try {
      await ordenes.activar(perfilId);
    } catch (error) {
      avisarError(error);
      setOcupado(false);
    }
  };

  if (perfiles.isPending) return <Cargando texto="Cargando perfiles…" />;
  if (perfiles.isError)
    return <ErrorPantalla error={perfiles.error} onReintentar={() => void perfiles.refetch()} />;

  /** Última sesión de cada perfil (las sesiones llegan de la más reciente a la más antigua). */
  const ultima = new Map<string, string>();
  for (const s of sesiones.data ?? [])
    if (!ultima.has(s.perfil_id)) ultima.set(s.perfil_id, s.inicio);

  return (
    <Pantalla
      titulo="¿Quién va a usar NeuroAcceso?"
      descripcion={
        perfiles.data.length === 0
          ? 'Cada persona tiene su propio perfil, con su calibración, sus gestos y sus frases. Crea el primero para empezar.'
          : 'Cada persona tiene su calibración, sus gestos y sus frases.'
      }
    >
      <ul className={estilos.tarjetas} aria-label="Perfiles">
        {perfiles.data.map((perfil) => {
          const fecha = ultima.get(perfil.id);
          return (
            <li key={perfil.id}>
              <button
                type="button"
                className={estilos.tarjeta}
                aria-current={perfil.id === activoId ? 'true' : undefined}
                disabled={ocupado}
                onClick={() => void activar(perfil.id)}
              >
                <Icono nombre="perfil" tamano="3rem" />
                <span className={estilos.nombre}>{perfil.nombre}</span>
                <span className={estilos.detalle}>
                  {fecha ? `Última sesión ${haceCuanto(fecha)}` : 'Sin sesiones todavía'}
                </span>
                {perfil.id === activoId && <span className={estilos.marca}>En uso</span>}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className={`${estilos.tarjeta} ${estilos.nuevo}`}
            onClick={() => setCreando(true)}
          >
            <Icono nombre="mas" tamano="3rem" />
            <span className={estilos.nombre}>Nuevo perfil</span>
          </button>
        </li>
      </ul>

      <p className={estilos.casco}>
        <IndicadorEstado tono={conexion.tono}>{conexion.texto}</IndicadorEstado>
        {contacto && <IndicadorEstado tono={contacto.tono}>{contacto.texto}</IndicadorEstado>}
        {perfiles.data.length > 0 && <Link to="/perfiles">Gestionar perfiles</Link>}
      </p>

      <DialogoNombre
        abierto={creando}
        titulo="Nuevo perfil"
        accion="Crear y empezar"
        onCerrar={() => setCreando(false)}
        onConfirmar={async (nombre) => {
          const perfil = await ordenes.crear(nombre);
          await ordenes.activar(perfil.id);
        }}
      />
    </Pantalla>
  );
}
