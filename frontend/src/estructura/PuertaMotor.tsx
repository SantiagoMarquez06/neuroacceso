import type { ReactNode } from 'react';
import { ES_MOCK } from '../api/config';
import { BotonGrande, Cargando, Vacio } from '../componentes';
import { clienteEventos } from '../estado/conexion';
import { useMotor } from '../estado/motor';
import { ERRORES } from '../textos';

/**
 * Decide qué se ve mientras no se conoce el estado del motor: nunca una pantalla en blanco.
 * En cuanto llega el primer `hola`, muestra la pantalla; si después se pierde la conexión, la
 * pantalla sigue visible con un aviso arriba (ver AvisosGlobales).
 */
export function PuertaMotor({ children }: { children: ReactNode }) {
  const enlace = useMotor((s) => s.enlace.estado);
  const conocido = useMotor((s) => s.estado !== null);

  if (enlace === 'no_autorizado') {
    return (
      <Vacio icono="alerta" titulo={ERRORES.NO_AUTORIZADO.titulo}>
        <p>{ERRORES.NO_AUTORIZADO.ayuda}</p>
        {import.meta.env.DEV && !ES_MOCK && (
          <p>
            En desarrollo: abre <code>http://localhost:5173/#token=…</code> con el token que imprime
            el motor al arrancar (<code>--demo --dev</code>).
          </p>
        )}
      </Vacio>
    );
  }

  if (conocido) return children;

  if (enlace === 'reconectando') {
    return (
      <Vacio
        icono="alerta"
        titulo={ERRORES.MOTOR_NO_DISPONIBLE.titulo}
        accion={
          <BotonGrande
            variante="principal"
            icono="reintentar"
            onClick={() => clienteEventos.reintentarAhora()}
          >
            Reintentar ahora
          </BotonGrande>
        }
      >
        <p role="status">{ERRORES.MOTOR_NO_DISPONIBLE.ayuda}</p>
      </Vacio>
    );
  }

  return <Cargando texto="Conectando con NeuroAcceso…" />;
}
