// Issue #45: ninguna pantalla queda en blanco ni muestra un error técnico.
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api, ErrorApi } from '../api/rest';
import type { Perfil } from '../api/tipos';
import { reiniciarMotor } from '../estado/motor';
import { usarMotorFalso } from '../pruebas/motorDePrueba';
import { renderizarApp } from '../pruebas/utilidades';

beforeEach(() => reiniciarMotor());

describe('estados de error', () => {
  test('si una pantalla falla al dibujarse, se ve un mensaje claro con salidas', async () => {
    usarMotorFalso();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Datos imposibles del servidor: la pantalla revienta al dibujarlos.
    vi.spyOn(api.perfiles, 'listar').mockResolvedValue(null as unknown as Perfil[]);

    renderizarApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/TypeError|null|undefined/);
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ir al inicio' })).toBeInTheDocument();
  });

  test.each(['/', '/perfiles'])('%s: si el motor no responde, ofrece reintentar', async (ruta) => {
    usarMotorFalso();
    const listar = vi
      .spyOn(api.perfiles, 'listar')
      .mockRejectedValue(new ErrorApi(0, 'MOTOR_NO_DISPONIBLE', 'x'));
    const { usuario } = renderizarApp(ruta);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se puede conectar con NeuroAcceso',
    );
    listar.mockResolvedValue([]);
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('button', { name: /Nuevo perfil/ })).toBeInTheDocument();
  });

  test('ajustes: si no cargan, error claro con reintento', async () => {
    usarMotorFalso();
    vi.spyOn(api.perfiles, 'ajustes').mockRejectedValue(
      new ErrorApi(404, 'PERFIL_NO_ENCONTRADO', 'x'),
    );
    renderizarApp('/ajustes');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese perfil ya no existe');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  test('historial: un error del motor se explica, nunca un JSON', async () => {
    usarMotorFalso();
    vi.spyOn(api.sesiones, 'listar').mockRejectedValue(
      new ErrorApi(500, 'DESCONOCIDO', '{"detail":"Internal Server Error"}'),
    );
    renderizarApp('/historial');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Algo salió mal');
    expect(alerta).not.toHaveTextContent(/detail|Internal/);
  });
});

describe('estados de carga', () => {
  test.each(['/', '/perfiles', '/ajustes', '/historial'])(
    '%s muestra que está cargando mientras espera al motor',
    (ruta) => {
      usarMotorFalso();
      const nunca = () => new Promise<never>(() => undefined);
      vi.spyOn(api.perfiles, 'listar').mockImplementation(nunca);
      vi.spyOn(api.perfiles, 'ajustes').mockImplementation(nunca);
      vi.spyOn(api.sesiones, 'listar').mockImplementation(nunca);
      renderizarApp(ruta);

      expect(screen.getAllByRole('status').some((s) => /Cargando/.test(s.textContent ?? ''))).toBe(
        true,
      );
    },
  );
});
