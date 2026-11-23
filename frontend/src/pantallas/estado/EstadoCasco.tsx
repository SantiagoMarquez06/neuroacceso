// Panel principal — Estado del casco (docs/pantallas.md §4.3). Todo llega en vivo por el
// WebSocket: contacto por sensor, batería, orientación, gestos, acciones y modo.
import { useState } from 'react';
import { api } from '../../api/rest';
import {
  BarraProgreso,
  BotonGrande,
  IndicadorEstado,
  IndicadorOrientacion,
  ListaEventos,
  MapaSensores,
  Medidor,
  Tarjeta,
} from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useMotor } from '../../estado/motor';
import { pedirModo } from '../../estado/ordenes';
import { Pantalla } from '../../estructura/Pantalla';
import { CONTACTO_BUENO, CONTACTO_MINIMO } from '../../estructura/resumen';
import { describirAccion, NOMBRE_MODO, nombreGesto, zonasPorRevisar } from '../../textos';
import estilos from './EstadoCasco.module.css';

const lista = (partes: string[]) =>
  new Intl.ListFormat('es', { style: 'long', type: 'conjunction' }).format(partes);

export function EstadoCasco() {
  return (
    <Pantalla titulo="Estado del casco">
      <div className={estilos.rejilla}>
        <Contacto />
        <div className={estilos.columna}>
          <UltimoGesto />
          <Cursor />
          <Registro />
        </div>
      </div>
    </Pantalla>
  );
}

function Contacto() {
  const conectado = useMotor((s) => s.estado?.conexion.estado === 'conectado');
  const dispositivo = useMotor((s) => s.dispositivo);
  const contacto = conectado ? (dispositivo?.contacto ?? null) : null;
  const calidad = conectado ? dispositivo?.calidad_global : undefined;
  const zonas = zonasPorRevisar(contacto);

  return (
    <Tarjeta titulo="Calidad de contacto" className={estilos.contacto}>
      <MapaSensores contacto={contacto} />
      {calidad === undefined ? (
        <p className={estilos.nota}>
          {conectado ? 'Esperando los datos del casco…' : 'Conecta el casco para ver el contacto.'}
        </p>
      ) : (
        <div className={estilos.global}>
          <Medidor
            valor={calidad / 100}
            etiqueta="Contacto global"
            tamano={112}
            tono={calidad >= CONTACTO_BUENO ? 'bien' : calidad >= CONTACTO_MINIMO ? 'aviso' : 'mal'}
          />
          <div>
            <p className={estilos.globalTitulo}>Contacto global</p>
            <p className={estilos.nota} role="status">
              {zonas.length === 0
                ? 'Todos los sensores hacen buen contacto.'
                : `Humedece y ajusta los sensores de: ${lista(zonas)}.`}
            </p>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

function UltimoGesto() {
  const gesto = useMotor((s) => s.gesto);
  const accion = useMotor((s) => s.accion);
  // La acción corresponde al gesto mostrado si la originó él y llegó justo después.
  const suAccion =
    gesto && accion && accion.origen.nombre === gesto.gesto && accion.t >= gesto.t ? accion : null;

  return (
    <Tarjeta titulo="Último gesto">
      {gesto ? (
        <div className={estilos.gesto}>
          <p className={estilos.gestoNombre}>{nombreGesto(gesto.gesto)}</p>
          <p className={estilos.gestoAccion}>
            {suAccion ? (
              <IndicadorEstado tono={suAccion.ejecutada ? 'bien' : 'aviso'}>
                {describirAccion(suAccion)}
              </IndicadorEstado>
            ) : (
              'Sin acción asignada en este modo'
            )}
          </p>
          <div className={estilos.potencia}>
            <span>Intensidad</span>
            <BarraProgreso valor={gesto.potencia} etiqueta="Intensidad del gesto" />
          </div>
        </div>
      ) : (
        <p className={estilos.nota}>Todavía no se ha reconocido ningún gesto.</p>
      )}
    </Tarjeta>
  );
}

function Cursor() {
  const modo = useMotor((s) => s.estado?.modo ?? 'desconectado');
  const calibrado = useMotor((s) => s.estado?.calibrado ?? false);
  const calibracion = useMotor((s) => s.calibracion);
  const [ocupado, setOcupado] = useState(false);

  const ordenar = async (orden: () => Promise<unknown>) => {
    setOcupado(true);
    try {
      await orden();
    } catch (error) {
      avisarError(error);
    } finally {
      setOcupado(false);
    }
  };

  const enPausa = modo === 'pausa';
  const hayCasco = modo !== 'desconectado';
  const calibrando = modo === 'calibrando';

  return (
    <Tarjeta titulo="Cursor">
      <div className={estilos.cursor}>
        <div className={estilos.cursorEstado}>
          <IndicadorEstado
            tono={modo === 'cursor' ? 'bien' : hayCasco ? 'aviso' : 'apagado'}
            destacado
          >
            {modo === 'cursor' ? 'Activo' : NOMBRE_MODO[modo]}
          </IndicadorEstado>
          {hayCasco && !calibrado && !calibrando && (
            <p className={estilos.nota}>Falta calibrar: el cursor no se moverá hasta hacerlo.</p>
          )}
          {calibrando && calibracion && (
            <div className={estilos.calibrando}>
              <p role="status">{calibracion.instruccion}</p>
              <BarraProgreso valor={calibracion.progreso} etiqueta="Progreso de la calibración" />
            </div>
          )}
          <div className={estilos.botones}>
            {calibrando ? (
              <BotonGrande
                icono="cerrar"
                disabled={ocupado}
                onClick={() => ordenar(api.cancelarCalibracion)}
              >
                Cancelar calibración
              </BotonGrande>
            ) : (
              <>
                <BotonGrande
                  variante="principal"
                  icono={enPausa ? 'reanudar' : 'pausa'}
                  disabled={ocupado || (modo !== 'cursor' && !enPausa)}
                  onClick={() => ordenar(() => pedirModo(enPausa ? 'cursor' : 'pausa'))}
                >
                  {enPausa ? 'Reanudar' : 'Pausar'}
                </BotonGrande>
                <BotonGrande
                  icono="practica"
                  disabled={ocupado || !hayCasco || modo === 'entrenando'}
                  onClick={() => ordenar(api.calibrar)}
                >
                  Recalibrar
                </BotonGrande>
              </>
            )}
          </div>
        </div>
        <IndicadorOrientacion />
      </div>
    </Tarjeta>
  );
}

function Registro() {
  const registro = useMotor((s) => s.registro);
  return (
    <Tarjeta titulo="Registro de eventos">
      <ListaEventos entradas={registro} />
    </Tarjeta>
  );
}
