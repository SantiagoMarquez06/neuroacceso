import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { usePerfilActivo, useSalud } from '../api/consultas';
import {
  Bateria,
  Icono,
  IndicadorEstado,
  type NombreIcono,
  type TonoIndicador,
} from '../componentes';
import { useEvento } from '../estado/conexion';
import { useMotor } from '../estado/motor';
import { describirAccion, nombreGesto } from '../textos';
import estilos from './Armazon.module.css';
import { AvisosBreves, AvisosGlobales } from './Avisos';
import { PuertaMotor } from './PuertaMotor';
import { resumenConexion, resumenContacto, resumenModo } from './resumen';

interface Destino {
  a: string;
  icono: NombreIcono;
  texto: string;
}

const MENU: Destino[] = [
  { a: '/estado', icono: 'inicio', texto: 'Inicio' },
  { a: '/comunicador', icono: 'hablar', texto: 'Hablar' },
  { a: '/practica', icono: 'practica', texto: 'Práctica' },
  { a: '/entrenamiento', icono: 'entrenar', texto: 'Entrenar' },
  { a: '/ajustes', icono: 'ajustes', texto: 'Ajustes' },
  { a: '/historial', icono: 'historial', texto: 'Historial' },
];
const MENU_DEMO: Destino = { a: '/dev', icono: 'desarrollo', texto: 'Pruebas' };

/** Pantallas que ocupan todo el ancho: ocultan el menú para ganar espacio. */
const SIN_MENU = ['/comunicador'];

/** Tiempo que la franja inferior muestra el último gesto o acción. */
const DURACION_RETRO_MS = 2500;

/**
 * Estructura común de todas las pantallas: barra superior (estado siempre visible), menú
 * lateral, contenido y franja de retroalimentación.
 */
export function Armazon() {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const sinMenu = SIN_MENU.includes(pathname);

  // El modo lo decide el motor. Si pasa a comunicador (gesto de rescate, o el botón "Hablar" de
  // la barra flotante), esta ventana abre el comunicador; si el gesto de rescate lo saca de él,
  // vuelve al panel principal. Así el usuario nunca queda atrapado en una pantalla.
  useEvento('modo', ({ modo, motivo }) => {
    if (modo === 'comunicador' && pathname !== '/comunicador') {
      navegar('/comunicador');
    } else if (
      pathname === '/comunicador' &&
      motivo === 'gesto_rescate' &&
      modo !== 'comunicador'
    ) {
      navegar('/estado');
    }
  });

  return (
    <div className={[estilos.armazon, sinMenu && estilos.sinMenu].filter(Boolean).join(' ')}>
      <a className={estilos.saltar} href="#contenido">
        Saltar al contenido
      </a>
      <BarraSuperior />
      {!sinMenu && <MenuLateral />}
      <main id="contenido" className={estilos.contenido} tabIndex={-1}>
        <PuertaMotor>
          <AvisosGlobales />
          <Outlet />
        </PuertaMotor>
      </main>
      <FranjaRetro />
      <AvisosBreves />
    </div>
  );
}

function BarraSuperior() {
  // useShallow: los resúmenes son objetos nuevos en cada lectura; se comparan por contenido.
  const conexion = useMotor(useShallow(resumenConexion));
  const modo = useMotor(useShallow(resumenModo));
  const contacto = useMotor(useShallow(resumenContacto));
  const bateria = useMotor((s) => s.dispositivo?.bateria_pct ?? null);
  const hayCasco = useMotor((s) => s.estado?.conexion.estado === 'conectado');
  const perfil = usePerfilActivo();

  return (
    <header className={estilos.barra}>
      <Link to="/estado" className={estilos.marca}>
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <ellipse cx="16" cy="17" rx="11.5" ry="12.5" />
          <path d="M13 5.5 16 2l3 3.5" />
          <circle className={estilos.marcaPunto} cx="11.5" cy="13" r="2.4" />
          <circle className={estilos.marcaPunto} cx="20.5" cy="13" r="2.4" />
          <circle className={estilos.marcaPunto} cx="16" cy="22" r="2.4" />
        </svg>
        NeuroAcceso
      </Link>

      <Link
        to="/"
        className={estilos.perfil}
        aria-label={`Perfil activo: ${perfil?.nombre ?? 'Elegir perfil'}`}
      >
        <Icono nombre="perfil" />
        {perfil?.nombre ?? 'Elegir perfil'}
      </Link>

      <ul className={estilos.estados} aria-label="Estado del sistema">
        <li>
          {/* El estado del casco lleva a su pantalla de detalle. */}
          <Link to="/estado" className={estilos.estadoEnlace}>
            <IndicadorEstado tono={conexion.tono} destacado>
              {conexion.texto}
            </IndicadorEstado>
          </Link>
        </li>
        {hayCasco && contacto && (
          <li>
            <IndicadorEstado tono={contacto.tono} destacado>
              {contacto.texto}
            </IndicadorEstado>
          </li>
        )}
        {modo && (
          <li>
            <IndicadorEstado tono={modo.tono} destacado>
              {modo.texto}
            </IndicadorEstado>
          </li>
        )}
        {hayCasco && (
          <li>
            <Bateria porcentaje={bateria} className={estilos.bateria} />
          </li>
        )}
      </ul>
    </header>
  );
}

function MenuLateral() {
  const { data: salud } = useSalud();
  const destinos = salud?.demo ? [...MENU, MENU_DEMO] : MENU;
  return (
    <nav className={estilos.menu} aria-label="Pantallas">
      {destinos.map(({ a, icono, texto }) => (
        <NavLink
          key={a}
          to={a}
          className={({ isActive }) =>
            [estilos.destino, isActive && estilos.destinoActivo].filter(Boolean).join(' ')
          }
        >
          <Icono nombre={icono} tamano="1.8rem" />
          <span className={estilos.destinoTexto}>{texto}</span>
        </NavLink>
      ))}
    </nav>
  );
}

interface Retro {
  texto: string;
  tono: TonoIndicador;
}

/**
 * Franja inferior: muestra unos segundos cada gesto que el sistema reconoce y lo que hizo con
 * él, para que la persona sepa que "le entendió". Si no hizo nada, dice por qué.
 */
function FranjaRetro() {
  const gesto = useMotor((s) => s.gesto);
  const accion = useMotor((s) => s.accion);
  // Lo más reciente de los dos. La acción gana a su propio gesto, que llega justo antes.
  const ultimo = accion && (!gesto || accion.t >= gesto.t) ? accion : gesto;
  const [caducado, setCaducado] = useState<object | null>(null);

  useEffect(() => {
    if (!ultimo) return;
    const id = setTimeout(() => setCaducado(ultimo), DURACION_RETRO_MS);
    return () => clearTimeout(id);
  }, [ultimo]);

  let retro: Retro | null = null;
  if (ultimo && ultimo !== caducado) {
    retro =
      'accion' in ultimo
        ? { texto: describirAccion(ultimo), tono: ultimo.ejecutada ? 'bien' : 'aviso' }
        : { texto: nombreGesto(ultimo.gesto), tono: 'accion' };
  }

  return (
    <footer className={estilos.franja}>
      <p role="status" aria-live="polite" aria-label="Último gesto">
        {retro ? (
          <IndicadorEstado tono={retro.tono} destacado>
            {retro.texto}
          </IndicadorEstado>
        ) : (
          <span className={estilos.franjaReposo}>
            Aquí verás cada gesto que el sistema reconozca.
          </span>
        )}
      </p>
    </footer>
  );
}
