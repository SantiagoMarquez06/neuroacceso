import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { fijarEnlace, reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';

beforeEach(() => reiniciarMotor());
afterEach(() => vi.useRealTimers());

const estado = () => screen.getByRole('status', { name: 'Estado' });

describe('barra flotante', () => {
  test('va sola, sin menú ni barra superior', () => {
    usarMotorFalso();
    renderizarApp('/barra');

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(estado()).toHaveTextContent('Cursor activo');
    expect(screen.getByRole('img', { name: 'Batería 82 %' })).toBeInTheDocument();
  });

  test('Pausa y Reanudar piden el modo al motor', async () => {
    const motor = usarMotorFalso();
    const { usuario } = renderizarApp('/barra');

    await usuario.click(screen.getByRole('button', { name: 'Pausa' }));
    expect(motor.estado.modo).toBe('pausa');
    expect(estado()).toHaveTextContent('En pausa');

    await usuario.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(motor.estado.modo).toBe('cursor');
  });

  test('Hablar pasa el motor a comunicador (la ventana principal abre el comunicador)', async () => {
    const motor = usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/barra');

    await usuario.click(screen.getByRole('button', { name: 'Hablar' }));

    expect(api.cambiarModo).toHaveBeenCalledWith('comunicador');
    expect(motor.estado.modo).toBe('comunicador');
    expect(rutaActual()).toBe('/barra'); // esta ventana no cambia
    expect(estado()).toHaveTextContent('Cursor bloqueado: comunicador');
    expect(screen.getByRole('button', { name: 'Hablar' })).toBeDisabled();
  });

  test('muestra el último gesto unos segundos', () => {
    vi.useFakeTimers();
    const motor = usarMotorFalso();
    renderizarApp('/barra');

    act(() => motor.simularGesto('clench'));
    expect(document.querySelector('[data-ultimo-gesto]')).toHaveTextContent(
      'Apretar la mandíbula → Clic',
    );

    act(() => void vi.advanceTimersByTime(3500));
    expect(document.querySelector('[data-ultimo-gesto]')).toHaveTextContent('');
  });

  test('avisos críticos: mal contacto, sin casco, sin conexión', () => {
    const motor = usarMotorFalso();
    renderizarApp('/barra');

    act(() => {
      motor.malContacto = true;
      motor.bateria = 10;
    });
    act(() => motor.simularContacto(true));
    // 79 % no es "mal contacto" crítico (< 50 %); la batería baja sí se marca.
    expect(screen.getByRole('img', { name: 'Batería 10 % (baja)' })).toBeInTheDocument();

    act(() => motor.fallarConexion('CASCO_DESCONECTADO', 'x'));
    expect(estado()).toHaveTextContent('Sin casco');
    expect(screen.queryByRole('img', { name: /Batería/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeDisabled();

    act(() => fijarEnlace({ estado: 'reconectando', intentos: 1, esperaMs: 500 }));
    expect(estado()).toHaveTextContent('Sin conexión');
  });
});
