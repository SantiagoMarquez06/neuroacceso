import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';

beforeEach(() => {
  reiniciarMotor();
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => vi.useRealTimers());

const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const tarjeta = (nombre: string) => screen.getByRole('region', { name: nombre });

describe('entrenamiento', () => {
  test('guía a empezar por "relajado": lo demás espera hasta entrenarlo', () => {
    usarMotorFalso();
    renderizarApp('/entrenamiento');

    const mental = tarjeta('Comando mental');
    expect(within(mental).getByText(/Empieza por/)).toBeInTheDocument();
    expect(within(mental).getByRole('button', { name: 'Relajado' })).toBeEnabled();
    expect(within(mental).getByRole('button', { name: 'Empujar (mental)' })).toBeDisabled();
  });

  test('neutral y después empujar, de principio a fin', async () => {
    const motor = usarMotorFalso({ entrenamientoMs: 2000 });
    const { usuario } = renderizarApp('/entrenamiento');

    // 1. Relajado
    await usuario.click(
      within(tarjeta('Comando mental')).getByRole('button', { name: 'Relajado' }),
    );
    expect(api.entrenamiento.iniciar).toHaveBeenCalledWith('mental', 'neutral');
    expect(screen.getByRole('heading', { name: 'Entrenar: Relajado' })).toBeInTheDocument();
    expect(screen.getByText('Relájate y no hagas nada')).toBeInTheDocument();
    expect(screen.getByText('El cursor está detenido mientras se entrena.')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Tiempo restante de la toma' }),
    ).toHaveTextContent('8');

    pasar(2000); // el casco termina la toma
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(api.entrenamiento.aceptar).toHaveBeenCalledOnce();
    expect(screen.getByText('Entrenamiento guardado')).toBeInTheDocument();
    expect(motor.estado.modo).toBe('cursor');

    // 2. Empujar, ya desbloqueado
    await usuario.click(screen.getByRole('button', { name: 'Elegir otro' }));
    const mental = tarjeta('Comando mental');
    expect(within(mental).getByText('1 toma')).toBeInTheDocument();
    await usuario.click(within(mental).getByRole('button', { name: 'Empujar (mental)' }));
    expect(screen.getByText('Imagina que empujas el cubo')).toBeInTheDocument();
    pasar(2000);
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));

    await usuario.click(screen.getByRole('button', { name: 'Elegir otro' }));
    expect(within(tarjeta('Comando mental')).getAllByText('1 toma')).toHaveLength(2);
  });

  test('rechazar descarta la toma y vuelve a elegir', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/entrenamiento');
    await usuario.click(
      within(tarjeta('Gestos de la cara')).getByRole('button', { name: 'Relajado' }),
    );
    pasar(1000);

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(api.entrenamiento.rechazar).toHaveBeenCalledOnce();
    expect(
      within(tarjeta('Gestos de la cara')).getAllByText('Sin entrenar').length,
    ).toBeGreaterThan(0);
  });

  test('Cancelar durante la toma devuelve el motor al cursor', async () => {
    const motor = usarMotorFalso({ entrenamientoMs: 8000 });
    const { usuario } = renderizarApp('/entrenamiento');
    await usuario.click(
      within(tarjeta('Comando mental')).getByRole('button', { name: 'Relajado' }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(motor.estado.modo).toBe('cursor');
    expect(screen.getByRole('heading', { name: 'Entrenamiento' })).toBeInTheDocument();
  });

  test('lo entrenado se recuerda por perfil', async () => {
    usarMotorFalso();
    const { usuario, unmount } = renderizarApp('/entrenamiento');
    await usuario.click(
      within(tarjeta('Comando mental')).getByRole('button', { name: 'Relajado' }),
    );
    pasar(1000);
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    unmount();

    renderizarApp('/entrenamiento');
    expect(
      within(tarjeta('Comando mental')).getByRole('button', { name: 'Empujar (mental)' }),
    ).toBeEnabled();
  });

  test('sin casco no se puede entrenar', () => {
    const motor = usarMotorFalso();
    renderizarApp('/entrenamiento');
    act(() => motor.fallarConexion('SIN_CASCO', 'x'));

    expect(screen.getByText('Conecta el casco para entrenar')).toBeInTheDocument();
    expect(
      within(tarjeta('Comando mental')).getByRole('button', { name: 'Relajado' }),
    ).toBeDisabled();
  });
});
