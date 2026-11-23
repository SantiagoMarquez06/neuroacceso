import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { GESTOS_SIMULADOS } from './gestosSimulados';
import { GESTOS_SIMULABLES } from '../../mocks/motorFalso';

beforeEach(() => reiniciarMotor());

describe('panel de pruebas', () => {
  test('solo funciona con el motor en modo demo', async () => {
    usarMotorFalso();
    vi.spyOn(api, 'salud').mockResolvedValue({
      version: '1.0.0',
      api_version: 1,
      fuente: 'cortex',
      demo: false,
    });
    renderizarApp('/dev');

    expect(await screen.findByText('Solo disponible con el casco simulado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apretar la mandíbula' })).not.toBeInTheDocument();
  });

  test('todos sus gestos los entiende el simulador', () => {
    for (const gesto of GESTOS_SIMULADOS) expect(GESTOS_SIMULABLES).toHaveProperty(gesto);
  });

  test('un botón de gesto lo dispara y se ve en el resto de la app', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/dev');

    await usuario.click(await screen.findByRole('button', { name: 'Apretar la mandíbula' }));

    expect(api.dev.simularGesto).toHaveBeenCalledWith('clench');
    expect(screen.getByRole('status', { name: 'Último gesto' })).toHaveTextContent(
      'Apretar la mandíbula → Clic',
    );
  });

  test('el gesto de rescate desde el panel abre el comunicador (como con el casco)', async () => {
    usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/dev');

    await usuario.click(await screen.findByRole('button', { name: 'Cejas arriba' }));

    expect(rutaActual()).toBe('/comunicador');
  });

  test('el pad mueve la cabeza de 5 en 5 grados y Centro la devuelve', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/dev');
    const pad = await screen.findByRole('group', { name: 'Mover la cabeza' });

    await usuario.click(within(pad).getByRole('button', { name: 'Girar a la derecha' }));
    await usuario.click(within(pad).getByRole('button', { name: 'Girar a la derecha' }));
    await usuario.click(within(pad).getByRole('button', { name: 'Mirar arriba' }));
    expect(api.dev.simularCabeza).toHaveBeenLastCalledWith(10, 5);
    expect(screen.getByText('Giro 10° · Inclinación 5°')).toBeInTheDocument();

    await usuario.click(within(pad).getByRole('button', { name: 'Centro' }));
    expect(api.dev.simularCabeza).toHaveBeenLastCalledWith(0, 0);
  });

  test('el interruptor simula mal contacto y refleja el estado real del casco', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/dev');
    const interruptor = await screen.findByRole('switch', { name: /Simular mal contacto/ });
    expect(interruptor).toHaveAttribute('aria-checked', 'false');

    await usuario.click(interruptor);

    expect(api.dev.simularContacto).toHaveBeenCalledWith(true);
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
  });

  test('el visor muestra los eventos en crudo, sin la orientación por defecto', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/dev');
    await usuario.click(await screen.findByRole('button', { name: 'Parpadeo' }));
    await usuario.click(screen.getByRole('button', { name: 'Girar a la izquierda' }));

    const lista = screen.getByRole('list', { name: 'Eventos recibidos' });
    const textos = within(lista)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '');
    expect(textos).toHaveLength(1);
    expect(JSON.parse(textos[0]!)).toMatchObject({
      v: 1,
      tipo: 'gesto',
      datos: { gesto: 'blink' },
    });

    await usuario.click(screen.getByRole('button', { name: 'Vaciar' }));
    expect(screen.queryByRole('list', { name: 'Eventos recibidos' })).not.toBeInTheDocument();
  });
});
