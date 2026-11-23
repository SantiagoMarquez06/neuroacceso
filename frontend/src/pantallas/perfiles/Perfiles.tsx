// Perfiles (docs/pantallas.md §4.8): crear, renombrar, activar y eliminar.
import { useState } from 'react';
import { usePerfiles, useSesiones } from '../../api/consultas';
import type { Perfil } from '../../api/tipos';
import { BotonGrande, Cargando, Dialogo, ErrorPantalla, Tarjeta, Vacio } from '../../componentes';
import { avisar, avisarError } from '../../estado/avisos';
import { useMotor } from '../../estado/motor';
import { Pantalla } from '../../estructura/Pantalla';
import { formatoFechaHora } from '../../textos';
import { DialogoNombre } from './DialogoNombre';
import estilos from './Perfiles.module.css';
import { useOrdenesPerfiles } from './usarPerfiles';

export function Perfiles() {
  const perfiles = usePerfiles();
  const sesiones = useSesiones({});
  const activoId = useMotor((s) => s.estado?.perfil_activo_id);
  const ordenes = useOrdenesPerfiles();
  const [creando, setCreando] = useState(false);
  const [renombrando, setRenombrando] = useState<Perfil | null>(null);
  const [eliminando, setEliminando] = useState<Perfil | null>(null);

  if (perfiles.isPending) return <Cargando texto="Cargando perfiles…" />;
  if (perfiles.isError) {
    return <ErrorPantalla error={perfiles.error} onReintentar={() => void perfiles.refetch()} />;
  }

  const porPerfil = new Map<string, { n: number; ultima?: string }>();
  for (const s of sesiones.data ?? []) {
    const r = porPerfil.get(s.perfil_id) ?? { n: 0 };
    porPerfil.set(s.perfil_id, { n: r.n + 1, ultima: r.ultima ?? s.inicio });
  }

  const nuevo = (
    <BotonGrande variante="principal" icono="mas" onClick={() => setCreando(true)}>
      Nuevo perfil
    </BotonGrande>
  );

  return (
    <Pantalla titulo="Perfiles" ancho="lectura" acciones={perfiles.data.length > 0 && nuevo}>
      {perfiles.data.length === 0 ? (
        <Vacio icono="perfil" titulo="Todavía no hay perfiles" accion={nuevo}>
          <p>Cada persona que use NeuroAcceso necesita su propio perfil.</p>
        </Vacio>
      ) : (
        <ul className={estilos.lista} aria-label="Perfiles">
          {perfiles.data.map((perfil) => {
            const datos = porPerfil.get(perfil.id);
            const activo = perfil.id === activoId;
            return (
              <li key={perfil.id}>
                <Tarjeta titulo={perfil.nombre} nivel={2}>
                  <p className={estilos.detalle}>
                    {activo && <strong className={estilos.marcaLinea}>En uso · </strong>}
                    {datos
                      ? `${datos.n} ${datos.n === 1 ? 'sesión' : 'sesiones'}, la última el ${formatoFechaHora(datos.ultima!)}`
                      : 'Sin sesiones todavía'}
                    {perfil.cortex_profile && ` · Perfil de Emotiv: ${perfil.cortex_profile}`}
                  </p>
                  <div className={estilos.acciones}>
                    <BotonGrande
                      variante={activo ? 'secundario' : 'principal'}
                      icono="bien"
                      disabled={activo}
                      onClick={() => ordenes.activar(perfil.id).catch(avisarError)}
                    >
                      {activo ? 'En uso' : 'Usar este perfil'}
                    </BotonGrande>
                    <BotonGrande icono="editar" onClick={() => setRenombrando(perfil)}>
                      Cambiar nombre
                    </BotonGrande>
                    <BotonGrande
                      variante="peligro"
                      icono="borrar"
                      onClick={() => setEliminando(perfil)}
                    >
                      Eliminar
                    </BotonGrande>
                  </div>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      )}

      <DialogoNombre
        abierto={creando}
        titulo="Nuevo perfil"
        accion="Crear perfil"
        onCerrar={() => setCreando(false)}
        onConfirmar={async (nombre) => {
          await ordenes.crear(nombre);
          avisar({ tono: 'bien', titulo: `Perfil «${nombre}» creado` });
        }}
      />
      <DialogoNombre
        abierto={renombrando !== null}
        titulo="Cambiar nombre"
        accion="Guardar nombre"
        inicial={renombrando?.nombre}
        onCerrar={() => setRenombrando(null)}
        onConfirmar={(nombre) => ordenes.renombrar(renombrando!.id, nombre)}
      />
      <ConfirmarEliminar
        perfil={eliminando}
        sesiones={eliminando ? (porPerfil.get(eliminando.id)?.n ?? 0) : 0}
        onCerrar={() => setEliminando(null)}
        onConfirmar={async (perfil) => {
          await ordenes.eliminar(perfil.id);
          avisar({ tono: 'bien', titulo: `Perfil «${perfil.nombre}» eliminado` });
        }}
      />
    </Pantalla>
  );
}

interface PropsConfirmar {
  perfil: Perfil | null;
  sesiones: number;
  onCerrar: () => void;
  onConfirmar: (perfil: Perfil) => Promise<void>;
}

function ConfirmarEliminar({ perfil, sesiones, onCerrar, onConfirmar }: PropsConfirmar) {
  const [enviando, setEnviando] = useState(false);
  if (!perfil) return null;
  return (
    <Dialogo
      abierto
      titulo={`¿Eliminar el perfil «${perfil.nombre}»?`}
      onCerrar={onCerrar}
      acciones={
        <>
          <BotonGrande data-autofocus onClick={onCerrar}>
            Cancelar
          </BotonGrande>
          <BotonGrande
            variante="peligro"
            icono="borrar"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await onConfirmar(perfil);
                onCerrar();
              } catch (error) {
                avisarError(error);
              } finally {
                setEnviando(false);
              }
            }}
          >
            Eliminar para siempre
          </BotonGrande>
        </>
      }
    >
      <p>
        Se borrarán también{' '}
        {sesiones === 0
          ? 'sus ajustes'
          : `sus ajustes y sus ${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'} con sus resultados`}
        . No se puede deshacer.
      </p>
    </Dialogo>
  );
}
