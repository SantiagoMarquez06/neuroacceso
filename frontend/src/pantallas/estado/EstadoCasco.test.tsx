import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { orientacion } from '../../estado/orientacion';
import { llega, usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';

beforeEach(() => reiniciarMotor());
afterEach(() => vi.useRealTimers());

const tarjeta = (nombre: string) => screen.getByRole('region', { name: nombre });

describe('calidad de contacto', () => {
  test('dibuja los 14 sensores y resume el contacto global', () => {
    usarMotorFalso();
    const { container } = renderizarApp('/estado');

    expect(container.querySelectorAll('[data-sensor][data-nivel="bueno"]')).toHaveLength(14);
    const region = tarjeta('Calidad de contacto');
    expect(within(region).getByRole('progressbar', { name: 'Contacto global' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    expect(within(region).getByText('Todos los sensores hacen buen contacto.')).toBeInTheDocument();
  });

  test('un mal contacto simulado se refleja en el mapa y dice dónde revisar', () => {
    const motor = usarMotorFalso();
    const { container } = renderizarApp('/estado');

    act(() => motor.simularContacto(true));

    const nivel = (s: string) =>
      container.querySelector(`[data-sensor="${s}"]`)?.getAttribute('data-nivel');
    expect([nivel('T7'), nivel('P7'), nivel('O1'), nivel('FC6')]).toEqual([
      'malo',
      'malo',
      'malo',
      'malo',
    ]);
    expect(nivel('AF3')).toBe('bueno');
    const region = tarjeta('Calidad de contacto');
    expect(within(region).getByRole('progressbar', { name: 'Contacto global' })).toHaveAttribute(
      'aria-valuenow',
      '79',
    );
    expect(within(region).getByRole('status')).toHaveTextContent(
      'Humedece y ajusta los sensores de: sobre la oreja izquierda, detrás de la oreja izquierda, nuca izquierda y lado derecho.',
    );
  });

  test('sin casco no muestra datos viejos', () => {
    const motor = usarMotorFalso();
    const { container } = renderizarApp('/estado');

    act(() => motor.fallarConexion('CASCO_DESCONECTADO', 'El casco se desconectó'));

    expect(container.querySelectorAll('[data-nivel="sin_senal"]')).toHaveLength(14);
    expect(screen.getByText('Conecta el casco para ver el contacto.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Contacto global' })).not.toBeInTheDocument();
  });
});

describe('último gesto', () => {
  test('antes del primer gesto lo dice', () => {
    usarMotorFalso();
    renderizarApp('/estado');
    expect(
      within(tarjeta('Último gesto')).getByText(/no se ha reconocido ningún gesto/),
    ).toBeInTheDocument();
  });

  test('muestra el gesto, su acción y su intensidad', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => motor.simularGesto('winkR'));

    const region = tarjeta('Último gesto');
    expect(within(region).getByText('Guiño derecho')).toBeInTheDocument();
    expect(within(region).getByText('Guiño derecho → Clic derecho')).toBeInTheDocument();
    expect(
      within(region).getByRole('progressbar', { name: 'Intensidad del gesto' }),
    ).toHaveAttribute('aria-valuenow', '100');
  });

  test('un gesto sin acción no arrastra la acción del gesto anterior', () => {
    let reloj = 0;
    const motor = usarMotorFalso({ ahora: () => (reloj += 2000) });
    renderizarApp('/estado');

    act(() => motor.simularGesto('clench'));
    act(() => motor.simularGesto('blink'));

    const region = tarjeta('Último gesto');
    expect(within(region).getByText('Parpadeo')).toBeInTheDocument();
    expect(within(region).getByText('Sin acción asignada en este modo')).toBeInTheDocument();
  });
});

describe('cursor', () => {
  test('Pausar pide el modo pausa y el botón pasa a Reanudar', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/estado');
    const region = tarjeta('Cursor');
    expect(within(region).getByText('Activo')).toBeInTheDocument();

    await usuario.click(within(region).getByRole('button', { name: 'Pausar' }));

    expect(api.cambiarModo).toHaveBeenCalledWith('pausa');
    expect(within(region).getByText('En pausa')).toBeInTheDocument();

    await usuario.click(within(region).getByRole('button', { name: 'Reanudar' }));
    expect(api.cambiarModo).toHaveBeenLastCalledWith('cursor');
    expect(within(region).getByText('Activo')).toBeInTheDocument();
  });

  test('si el motor pausa por un gesto, la pantalla lo refleja sin haberlo pedido', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => motor.simularGesto('winkL'));

    expect(within(tarjeta('Cursor')).getByRole('button', { name: 'Reanudar' })).toBeInTheDocument();
  });

  test('Recalibrar muestra el progreso y la instrucción hasta completar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    usarMotorFalso({ calibracionMs: 1000 });
    const { usuario } = renderizarApp('/estado');
    const region = tarjeta('Cursor');

    await usuario.click(within(region).getByRole('button', { name: 'Recalibrar' }));
    expect(api.calibrar).toHaveBeenCalledOnce();
    expect(within(region).getByText('Calibrando')).toBeInTheDocument();
    expect(within(region).getByRole('status')).toHaveTextContent('Mira al centro y no te muevas');

    act(() => void vi.advanceTimersByTime(600));
    expect(
      within(region).getByRole('progressbar', { name: 'Progreso de la calibración' }),
    ).toHaveAttribute('aria-valuenow', '60');

    act(() => void vi.advanceTimersByTime(400));
    expect(within(region).getByText('Activo')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Recalibrar' })).toBeEnabled();
  });

  test('la calibración se puede cancelar', async () => {
    const motor = usarMotorFalso();
    const { usuario } = renderizarApp('/estado');
    act(() => motor.calibrar());

    await usuario.click(screen.getByRole('button', { name: 'Cancelar calibración' }));

    expect(api.cancelarCalibracion).toHaveBeenCalledOnce();
    expect(within(tarjeta('Cursor')).getByText('Activo')).toBeInTheDocument();
    motor.detener();
  });

  test('sin casco no se puede pausar ni calibrar', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => motor.fallarConexion('SIN_CASCO', 'No hay casco'));

    const region = tarjeta('Cursor');
    expect(within(region).getByText('Sin casco')).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Pausar' })).toBeDisabled();
    expect(within(region).getByRole('button', { name: 'Recalibrar' })).toBeDisabled();
  });

  test('si una orden falla, avisa en lenguaje claro', async () => {
    usarMotorFalso();
    vi.spyOn(api, 'calibrar').mockRejectedValue(new Error('boom'));
    const { usuario } = renderizarApp('/estado');

    await usuario.click(screen.getByRole('button', { name: 'Recalibrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
  });

  test('la orientación se ve en vivo', () => {
    usarMotorFalso();
    renderizarApp('/estado');

    llega('orientacion', { yaw: 12.4, pitch: -3.2, calibrado: true });

    expect(screen.getByText('Giro +12° · Inclinación −3°')).toBeInTheDocument();
    expect(orientacion.leer().yaw).toBe(12.4);
  });
});

describe('registro de eventos', () => {
  test('anota gestos y acciones con su hora, lo último arriba', () => {
    let reloj = 0;
    const motor = usarMotorFalso({ ahora: () => (reloj += 2000) });
    renderizarApp('/estado');

    act(() => motor.simularGesto('blink'));
    act(() => motor.simularGesto('winkR'));

    const filas = within(screen.getByRole('log', { name: 'Registro de eventos' })).getAllByRole(
      'listitem',
    );
    expect(filas.map((f) => f.querySelector('span')?.textContent)).toEqual([
      'Guiño derecho → Clic derecho',
      'Parpadeo (sin acción)',
    ]);
  });

  test('vacío explica qué aparecerá', () => {
    usarMotorFalso();
    renderizarApp('/estado');
    expect(
      within(tarjeta('Registro de eventos')).getByText(/aparecerá cada gesto/),
    ).toBeInTheDocument();
  });
});
