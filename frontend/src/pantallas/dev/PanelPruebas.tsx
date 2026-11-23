// Panel de desarrollo (docs/pantallas.md §4.11): probar todas las pantallas SIN casco.
// Solo existe cuando el motor corre en `--demo` (o con `npm run dev:mock`).
import { useEffect, useRef, useState } from 'react';
import { useSalud } from '../../api/consultas';
import { api } from '../../api/rest';
import type { Evento } from '../../api/tipos';
import { BotonGrande, Cargando, Interruptor, Tarjeta, Vacio } from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { escucharTodo } from '../../estado/conexion';
import { useMotor } from '../../estado/motor';
import { Pantalla } from '../../estructura/Pantalla';
import { nombreGesto } from '../../textos';
import { GESTOS_SIMULADOS } from './gestosSimulados';
import estilos from './PanelPruebas.module.css';

/** Grados que se gira la cabeza en cada pulsación del pad. */
const PASO_GRADOS = 5;
const MAX_VISOR = 50;

async function ordenar(orden: () => Promise<unknown>) {
  try {
    await orden();
  } catch (error) {
    avisarError(error);
  }
}

export function PanelPruebas() {
  const { data: salud, isPending } = useSalud();

  if (isPending) return <Cargando texto="Consultando el motor…" />;
  if (!salud?.demo) {
    return (
      <Pantalla titulo="Panel de pruebas">
        <Vacio icono="desarrollo" titulo="Solo disponible con el casco simulado">
          <p>
            Arranca el motor con <code>--demo</code> para disparar gestos y mover la cabeza sin
            casco.
          </p>
        </Vacio>
      </Pantalla>
    );
  }

  return (
    <Pantalla
      titulo="Panel de pruebas"
      descripcion="Casco simulado: dispara gestos y mueve la cabeza para probar las pantallas sin hardware."
    >
      <div className={estilos.rejilla}>
        <Gestos />
        <Cabeza />
        <Contacto />
        <Visor />
      </div>
    </Pantalla>
  );
}

function Gestos() {
  return (
    <Tarjeta titulo="Gestos">
      <div className={estilos.gestos}>
        {GESTOS_SIMULADOS.map((gesto) => (
          <BotonGrande key={gesto} onClick={() => ordenar(() => api.dev.simularGesto(gesto))}>
            {nombreGesto(gesto)}
          </BotonGrande>
        ))}
      </div>
    </Tarjeta>
  );
}

function Cabeza() {
  const [cabeza, setCabeza] = useState({ yaw: 0, pitch: 0 });

  const mover = (yaw: number, pitch: number) => {
    const nueva = {
      yaw: Math.max(-180, Math.min(180, yaw)),
      pitch: Math.max(-60, Math.min(60, pitch)),
    };
    setCabeza(nueva);
    void ordenar(() => api.dev.simularCabeza(nueva.yaw, nueva.pitch));
  };

  return (
    <Tarjeta titulo="Cabeza">
      <div className={estilos.pad} role="group" aria-label="Mover la cabeza">
        <span />
        <BotonGrande
          icono="arriba"
          aria-label="Mirar arriba"
          onClick={() => mover(cabeza.yaw, cabeza.pitch + PASO_GRADOS)}
        />
        <span />
        <BotonGrande
          icono="volver"
          aria-label="Girar a la izquierda"
          onClick={() => mover(cabeza.yaw - PASO_GRADOS, cabeza.pitch)}
        />
        <BotonGrande variante="principal" onClick={() => mover(0, 0)}>
          Centro
        </BotonGrande>
        <BotonGrande
          icono="siguiente"
          aria-label="Girar a la derecha"
          onClick={() => mover(cabeza.yaw + PASO_GRADOS, cabeza.pitch)}
        />
        <span />
        <BotonGrande
          icono="abajo"
          aria-label="Mirar abajo"
          onClick={() => mover(cabeza.yaw, cabeza.pitch - PASO_GRADOS)}
        />
        <span />
      </div>
      <p className="numeros" role="status">
        Giro {cabeza.yaw}° · Inclinación {cabeza.pitch}°
      </p>
    </Tarjeta>
  );
}

function Contacto() {
  const malo = useMotor((s) => {
    const contacto = s.dispositivo?.contacto;
    return contacto ? Object.values(contacto).some((v) => v < 2) : false;
  });
  return (
    <Tarjeta titulo="Contacto">
      <Interruptor
        etiqueta="Simular mal contacto"
        activo={malo}
        ayuda="Cuatro sensores del lado izquierdo y de la nuca pierden contacto."
        onCambio={(activo) => ordenar(() => api.dev.simularContacto(activo))}
      />
    </Tarjeta>
  );
}

/** Últimos eventos del WebSocket en crudo (JSON), sin la orientación, que llega 20 veces/s. */
function Visor() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [conOrientacion, setConOrientacion] = useState(false);
  const conOrientacionRef = useRef(conOrientacion);

  useEffect(() => {
    conOrientacionRef.current = conOrientacion;
  }, [conOrientacion]);

  useEffect(
    () =>
      escucharTodo((evento) => {
        if (evento.tipo === 'orientacion' && !conOrientacionRef.current) return;
        setEventos((previos) => [evento, ...previos].slice(0, MAX_VISOR));
      }),
    [],
  );

  return (
    <Tarjeta
      titulo="Eventos en crudo"
      className={estilos.visor}
      acciones={
        <BotonGrande variante="fantasma" icono="borrar" onClick={() => setEventos([])}>
          Vaciar
        </BotonGrande>
      }
    >
      <Interruptor
        etiqueta="Incluir la orientación (muy frecuente)"
        activo={conOrientacion}
        onCambio={setConOrientacion}
      />
      {eventos.length === 0 ? (
        <p className={estilos.nota}>Dispara un gesto para ver aquí lo que envía el motor.</p>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- desplazable con teclado
        <ol className={estilos.crudos} aria-label="Eventos recibidos" tabIndex={0}>
          {eventos.map((evento) => (
            <li key={`${evento.seq}-${evento.t}-${evento.tipo}`}>
              <pre>{JSON.stringify(evento)}</pre>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}
