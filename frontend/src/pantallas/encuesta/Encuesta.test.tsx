import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { encuestasCsv, interpretarSUS, leerEncuestas, puntuacionSUS } from './sus';

beforeEach(() => {
  reiniciarMotor();
  localStorage.clear();
});

describe('puntuación SUS (Brooke, 1996)', () => {
  test.each([
    [[5, 1, 5, 1, 5, 1, 5, 1, 5, 1], 100],
    [[1, 5, 1, 5, 1, 5, 1, 5, 1, 5], 0],
    [[3, 3, 3, 3, 3, 3, 3, 3, 3, 3], 50],
    [[4, 2, 4, 1, 4, 2, 5, 2, 4, 3], 77.5],
  ])('%j → %d', (respuestas, esperado) => {
    expect(puntuacionSUS(respuestas)).toBe(esperado);
  });

  test('incompleta o fuera de rango no puntúa', () => {
    expect(puntuacionSUS([5, 1, 5, 1, 5, 1, 5, 1, 5, null])).toBeNull();
    expect(puntuacionSUS([6, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBeNull();
  });

  test('interpretación respecto a la media de 68', () => {
    expect(interpretarSUS(85)).toMatch(/Excelente/);
    expect(interpretarSUS(70)).toMatch(/por encima del promedio/);
    expect(interpretarSUS(60)).toMatch(/por debajo/);
    expect(interpretarSUS(40)).toMatch(/Baja/);
  });

  test('CSV con una fila por encuesta y el nombre escapado', () => {
    const csv = encuestasCsv([
      {
        participante: 'P01, Ana',
        fecha: '2026-12-01T10:00:00.000Z',
        respuestas: [4, 2, 4, 1, 4, 2, 5, 2, 4, 3],
        puntuacion: 77.5,
      },
    ]);
    expect(csv).toBe(
      'participante,fecha,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,sus\r\n' +
        '"P01, Ana",2026-12-01T10:00:00.000Z,4,2,4,1,4,2,5,2,4,3,77.5\r\n',
    );
  });
});

test('rellenar, ver la puntuación y guardar la encuesta del participante', async () => {
  usarMotorFalso();
  const { usuario } = renderizarApp('/encuesta');
  await waitFor(() => expect(screen.getByLabelText('Participante')).toHaveValue('Ana'));

  const preguntas = screen.getAllByRole('group');
  expect(preguntas).toHaveLength(10);
  const valores = [4, 2, 4, 1, 4, 2, 5, 2, 4, 3];
  for (const [i, pregunta] of preguntas.entries()) {
    const etiqueta = [
      '',
      'Totalmente en desacuerdo',
      'En desacuerdo',
      'Ni de acuerdo ni en desacuerdo',
      'De acuerdo',
      'Totalmente de acuerdo',
    ][valores[i]!]!;
    await usuario.click(
      within(pregunta).getByRole('radio', { name: new RegExp(`^${valores[i]} ${etiqueta}$`) }),
    );
  }

  expect(screen.getByText('77,5')).toBeInTheDocument();
  expect(screen.getByText(/por encima del promedio/)).toBeInTheDocument();

  await usuario.clear(screen.getByLabelText('Participante'));
  await usuario.type(screen.getByLabelText('Participante'), 'P01');
  await usuario.click(screen.getByRole('button', { name: 'Guardar encuesta' }));

  expect(leerEncuestas()).toMatchObject([{ participante: 'P01', puntuacion: 77.5 }]);
  expect(screen.getByRole('button', { name: 'Exportar 1 encuesta' })).toBeInTheDocument();
  expect(screen.getByText('Faltan 10 respuestas.')).toBeInTheDocument(); // lista para el siguiente
});
