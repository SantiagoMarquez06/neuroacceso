import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { desdePeriodo, resultado } from './resumen';

beforeEach(() => reiniciarMotor());

const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('historial', () => {
  test('muestra las sesiones del perfil con su resultado y gráficas por métrica', async () => {
    usarMotorFalso({ conHistorial: true });
    renderizarApp('/historial');

    expect(await screen.findByRole('heading', { name: 'Historial de Ana' })).toBeInTheDocument();
    await waitFor(() => expect(filas().length).toBeGreaterThan(0));
    // 30 días por defecto: las sesiones sembradas cada 3 días caen dentro (8 × 2 = 16).
    expect(filas()).toHaveLength(16);
    expect(filas()[0]).toHaveTextContent('Comunicador');
    expect(filas()[0]).toHaveTextContent(/caracteres\/min/);
    expect(screen.getByText('Rendimiento (bits/s)')).toBeInTheDocument();
    expect(screen.getByText('Velocidad de escritura (caracteres/min)')).toBeInTheDocument();
    // Cada gráfica tiene una descripción en texto (los valores exactos están en la tabla).
    expect(
      screen.getByRole('img', { name: /Rendimiento \(bits\/s\): 8 sesiones/ }),
    ).toBeInTheDocument();
  });

  test('filtra por tipo y por período', async () => {
    usarMotorFalso({ conHistorial: true });
    const { usuario } = renderizarApp('/historial');
    await waitFor(() => expect(filas()).toHaveLength(16));

    await usuario.selectOptions(screen.getByLabelText('Tipo de sesión'), 'practica');
    expect(filas()).toHaveLength(8);
    expect(screen.queryByText('Velocidad de escritura (caracteres/min)')).not.toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText('Período'), '7');
    await waitFor(() => expect(filas().length).toBeLessThan(8));
    expect(api.sesiones.listar).toHaveBeenLastCalledWith({
      perfil_id: 'p-1',
      desde: desdePeriodo(7),
    });
  });

  test('sin sesiones invita a hacer la primera', async () => {
    usarMotorFalso();
    renderizarApp('/historial');
    expect(await screen.findByText('No hay sesiones en este período')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer una práctica de puntería' })).toHaveAttribute(
      'href',
      '/practica',
    );
  });

  test('exporta el CSV del perfil', async () => {
    usarMotorFalso({ conHistorial: true });
    const crearUrl = vi.fn(() => 'blob:x');
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: vi.fn() }),
    );
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { usuario } = renderizarApp('/historial');

    await usuario.click(await screen.findByRole('button', { name: 'Exportar CSV' }));

    expect(api.sesiones.exportarCsv).toHaveBeenCalledWith('p-1');
    expect(clic).toHaveBeenCalledOnce();
    expect(await screen.findByText('Historial exportado')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  test('el detalle de una sesión muestra sus métricas', async () => {
    usarMotorFalso({ conHistorial: true });
    const { usuario, rutaActual } = renderizarApp('/historial');
    await waitFor(() => expect(filas()).toHaveLength(16));

    await usuario.click(within(filas()[1]!).getByRole('link'));

    expect(rutaActual()).toMatch(/^\/historial\/s-\d+$/);
    expect(
      await screen.findByRole('heading', { name: 'Práctica de puntería' }),
    ).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Resultados' });
    expect(within(region).getByText('Rendimiento')).toBeInTheDocument();
    expect(within(region).getByText(/bits\/s$/)).toBeInTheDocument();
  });

  test('sin perfil activo pide elegir uno', () => {
    usarMotorFalso({ sembrado: false });
    renderizarApp('/historial');
    expect(screen.getByText('Elige un perfil para ver su historial')).toBeInTheDocument();
  });
});

describe('resultado en una línea', () => {
  const base = {
    id: 's',
    perfil_id: 'p',
    inicio: '2026-12-01T10:00:00+00:00',
    fin: '2026-12-01T10:06:00+00:00',
  };
  const vacias = {
    throughput_bps: null,
    tiempo_medio_ms: null,
    precision: null,
    falsos_positivos_min: null,
    caracteres_min: null,
  };

  test.each([
    [
      {
        ...base,
        tipo: 'practica' as const,
        metricas: { ...vacias, throughput_bps: 1.723, precision: 0.93 },
      },
      '1,72 bits/s · 93 % de aciertos',
    ],
    [
      { ...base, tipo: 'comunicador' as const, metricas: { ...vacias, caracteres_min: 8.44 } },
      '8,4 caracteres/min',
    ],
    [{ ...base, tipo: 'comunicador' as const, metricas: vacias }, 'Sin frases'],
    [{ ...base, tipo: 'practica' as const, fin: null, metricas: null }, 'Sin terminar'],
  ])('%#', (sesion, esperado) => {
    expect(resultado(sesion)).toBe(esperado);
  });
});
