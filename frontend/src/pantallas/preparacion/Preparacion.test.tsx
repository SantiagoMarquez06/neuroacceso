import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { llega, usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { CONTACTO_ESTABLE_MS } from './Preparacion';

beforeEach(() => {
  reiniciarMotor();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const pasoActual = () => screen.getByRole('heading', { level: 2 });

test('de principio a fin solo con el casco: conexión → contacto → calibración → gestos', async () => {
  let reloj = 0;
  const motor = usarMotorFalso({
    sembrado: false,
    calibracionMs: 1000,
    ahora: () => (reloj += 2000),
  });
  motor.crearPerfil({ nombre: 'Ana' });
  act(() => void motor.activarPerfil('p-1'));
  const { usuario, rutaActual } = renderizarApp('/preparacion');

  // 1. Conexión
  expect(pasoActual()).toHaveTextContent('Paso 1 de 4: Conexión');
  await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(api.conectar).toHaveBeenCalled();
  pasar(300); // el casco se conecta y el motor empieza a calibrar solo

  // 2. Contacto: bueno → avanza solo tras un momento estable
  expect(pasoActual()).toHaveTextContent('Paso 2 de 4: Contacto');
  expect(screen.getByText('Buen contacto. Seguimos…')).toBeInTheDocument();
  pasar(CONTACTO_ESTABLE_MS);

  // 3. Calibración: la del arranque termina y pasa sola
  expect(pasoActual()).toHaveTextContent('Paso 3 de 4: Calibración');
  pasar(1000);

  // 4. Gestos: se marcan al hacerlos
  expect(pasoActual()).toHaveTextContent('Paso 4 de 4: Prueba de gestos');
  const lista = screen.getByRole('list', { name: 'Gestos a probar' });
  expect(within(lista).getAllByRole('listitem')).toHaveLength(4); // clench, winkR, winkL + rescate
  for (const gesto of ['clench', 'winkR', 'winkL', 'winkL', 'surprise']) {
    act(() => motor.simularGesto(gesto));
  }
  await act(async () => {});

  expect(within(lista).getAllByText(/: reconocido/)).toHaveLength(4);
  expect(screen.getByText('Todo listo')).toBeInTheDocument();
  // Probar el rescate no saca de la preparación y el motor vuelve a cursor.
  expect(rutaActual()).toBe('/preparacion');
  expect(motor.estado.modo).toBe('cursor');

  await usuario.click(screen.getByRole('button', { name: 'Empezar' }));
  expect(rutaActual()).toBe('/estado');
});

describe('cada paso', () => {
  test('conexión: si falla, dice qué hacer según el código', () => {
    const motor = usarMotorFalso({ sembrado: false });
    renderizarApp('/preparacion');

    act(() => motor.fallarConexion('APP_NO_APROBADA', 'x'));

    expect(
      screen.getByText('En el EMOTIV Launcher, aprueba la aplicación NeuroAcceso cuando lo pida.', {
        selector: 'p',
      }),
    ).toBeInTheDocument();
  });

  test('contacto: con mal contacto dice qué zonas mojar y no avanza solo', async () => {
    const motor = usarMotorFalso();
    act(() => motor.simularContacto(true));
    const { usuario } = renderizarApp('/preparacion');

    expect(pasoActual()).toHaveTextContent('Contacto');
    expect(
      screen.getByText(/Humedece y ajusta los sensores de: sobre la oreja izquierda/),
    ).toBeInTheDocument();
    pasar(5000);
    expect(pasoActual()).toHaveTextContent('Contacto');

    await usuario.click(screen.getByRole('button', { name: 'Continuar de todas formas' }));
    expect(pasoActual()).toHaveTextContent('Calibración');
  });

  test('calibración: si falla, permite repetir', async () => {
    const motor = usarMotorFalso({ calibracionMs: 1000 });
    motor.estado.calibrado = false;
    llega('hola', motor.hola());
    act(() => motor.simularContacto(true));
    const { usuario } = renderizarApp('/preparacion');
    await usuario.click(screen.getByRole('button', { name: 'Continuar de todas formas' }));
    expect(api.calibrar).toHaveBeenCalledOnce(); // sin calibrar: la pide al entrar

    act(() => motor.cancelarCalibracion());
    await usuario.click(screen.getByRole('button', { name: 'Repetir' }));
    expect(api.calibrar).toHaveBeenCalledTimes(2);
    pasar(1000);

    expect(pasoActual()).toHaveTextContent('Prueba de gestos');
  });

  test('si el casco se cae a mitad, vuelve al paso de conexión', () => {
    const motor = usarMotorFalso();
    renderizarApp('/preparacion');
    pasar(CONTACTO_ESTABLE_MS);
    expect(pasoActual()).toHaveTextContent('Calibración');

    act(() => motor.fallarConexion('CASCO_DESCONECTADO', 'x'));

    expect(pasoActual()).toHaveTextContent('Conexión');
  });
});
