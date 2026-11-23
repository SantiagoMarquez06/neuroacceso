// Avisos globales: lo que el usuario debe saber esté en la pantalla que esté.
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/rest';
import { Aviso, BATERIA_BAJA, BotonGrande } from '../componentes';
import { avisarError, cerrarAviso, useAvisos } from '../estado/avisos';
import { clienteEventos } from '../estado/conexion';
import { useMotor } from '../estado/motor';
import { ERRORES, zonasPorRevisar } from '../textos';
import estilos from './Avisos.module.css';
import { CONTACTO_MINIMO } from './resumen';

const lista = (partes: string[]) =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(partes);

/**
 * Avisos persistentes, arriba del contenido y sin bloquearlo: sin conexión con el motor, casco
 * desconectado (con qué hacer), batería baja y mal contacto.
 */
export function AvisosGlobales() {
  const enlace = useMotor((s) => s.enlace.estado);
  const conexion = useMotor((s) => s.estado?.conexion.estado);
  const codigo = useMotor((s) => s.codigoConexion);
  const bateria = useMotor((s) => s.dispositivo?.bateria_pct);
  const calidad = useMotor((s) => s.dispositivo?.calidad_global);
  const contacto = useMotor((s) => s.dispositivo?.contacto ?? null);
  const [reintentando, setReintentando] = useState(false);

  const reconectarCasco = async () => {
    setReintentando(true);
    try {
      await api.conectar();
    } catch (error) {
      avisarError(error);
    } finally {
      setReintentando(false);
    }
  };

  const avisos = [];

  if (enlace === 'reconectando') {
    avisos.push(
      <Aviso
        key="motor"
        tono="mal"
        titulo={ERRORES.MOTOR_NO_DISPONIBLE.titulo}
        acciones={
          <BotonGrande icono="reintentar" onClick={() => clienteEventos.reintentarAhora()}>
            Reintentar ahora
          </BotonGrande>
        }
      >
        Se está reintentando solo. Lo que ves puede no estar al día.
      </Aviso>,
    );
  } else if (conexion === 'error') {
    const { titulo, ayuda } = ERRORES[codigo ?? 'CASCO_DESCONECTADO'];
    avisos.push(
      <Aviso
        key="casco"
        tono="mal"
        titulo={titulo}
        acciones={
          <BotonGrande icono="reintentar" disabled={reintentando} onClick={reconectarCasco}>
            Reintentar
          </BotonGrande>
        }
      >
        {ayuda}
      </Aviso>,
    );
  }

  if (conexion === 'conectado') {
    if (bateria !== undefined && bateria < BATERIA_BAJA) {
      avisos.push(
        <Aviso key="bateria" tono="aviso" titulo={`Queda poca batería en el casco (${bateria} %)`}>
          Termina lo que estés haciendo y pon el casco a cargar.
        </Aviso>,
      );
    }
    if (calidad !== undefined && calidad < CONTACTO_MINIMO) {
      const zonas = zonasPorRevisar(contacto);
      avisos.push(
        <Aviso
          key="contacto"
          tono="aviso"
          titulo="El casco no hace buen contacto"
          acciones={
            <Link to="/estado" className={estilos.enlace}>
              Ver los sensores
            </Link>
          }
        >
          {zonas.length > 0
            ? `Humedece y ajusta los sensores de: ${lista(zonas)}.`
            : 'Humedece los sensores y ajusta el casco.'}
        </Aviso>,
      );
    }
  }

  if (avisos.length === 0) return null;
  return <div className={estilos.globales}>{avisos}</div>;
}

/** Avisos breves que se cierran solos (errores de una orden, confirmaciones). */
export function AvisosBreves() {
  const avisos = useAvisos((s) => s.avisos);
  if (avisos.length === 0) return null;
  return (
    <div className={estilos.breves}>
      {avisos.map((aviso) => (
        <Aviso
          key={aviso.id}
          tono={aviso.tono}
          titulo={aviso.titulo}
          acciones={
            <BotonGrande
              variante="fantasma"
              icono="cerrar"
              aria-label="Cerrar aviso"
              onClick={() => cerrarAviso(aviso.id)}
            />
          }
        >
          {aviso.detalle}
        </Aviso>
      ))}
    </div>
  );
}
