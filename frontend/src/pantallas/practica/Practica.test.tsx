import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import type { Intento } from '../../api/tipos';
import { reiniciarMotor } from '../../estado/motor';
import { calcularMetricas } from '../../mocks/metricas';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { formatoNumero } from '../../textos';
import {
  acierta,
  amplitudPara,
  objetivoDe,
  ordenISO,
  posiciones,
  RECORRIDO_INICIAL,
  registrarClic,
  type Tarea,
} from './iso';

beforeEach(() => reiniciarMotor());

describe('geometría ISO 9241-411', () => {
  test('alterna objetivos opuestos y pasa por todos una vez', () => {
    expect(ordenISO(5)).toEqual([0, 3, 1, 4, 2]);
    const quince = ordenISO(15);
    expect(quince.slice(0, 4)).toEqual([0, 8, 1, 9]);
    expect(new Set(quince).size).toBe(15);
  });

  test('cada movimiento cruza casi todo el círculo', () => {
    const t: Tarea = {
      n: 15,
      amplitud: 400,
      ancho: 80,
      centro: { x: 400, y: 260 },
      desde: 0,
      dpr: 1,
    };
    for (let paso = 0; paso < 14; paso += 1) {
      const a = objetivoDe(t, paso);
      const b = objetivoDe(t, paso + 1);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(395);
    }
  });

  test('los objetivos quedan en el círculo, el primero arriba', () => {
    const p = posiciones(4, 200, { x: 100, y: 100 });
    expect(p).toEqual([
      { x: 100, y: 0 },
      { x: 200, y: 100 },
      { x: 100, y: 200 },
      { x: 0, y: 100 },
    ]);
  });

  test('la amplitud cabe en el área y tiene límites razonables', () => {
    expect(amplitudPara({ ancho: 1200, alto: 640 }, 80)).toBe(528);
    expect(amplitudPara({ ancho: 3000, alto: 2000 }, 80)).toBe(600);
    expect(amplitudPara({ ancho: 300, alto: 200 }, 80)).toBe(200);
  });

  test('acierto: dentro del círculo del objetivo, incluido el borde', () => {
    expect(acierta({ x: 40, y: 0 }, { x: 0, y: 0 }, 80)).toBe(true);
    expect(acierta({ x: 40.1, y: 0 }, { x: 0, y: 0 }, 80)).toBe(false);
  });

  test('el clic de salida no se mide y debe caer en el objetivo', () => {
    const t: Tarea = {
      n: 5,
      amplitud: 300,
      ancho: 60,
      centro: { x: 200, y: 200 },
      desde: 10,
      dpr: 1.5,
    };
    const salida = objetivoDe(t, 0);

    const fallo = registrarClic(t, RECORRIDO_INICIAL, { x: 0, y: 0 }, 100);
    expect(fallo.recorrido).toBe(RECORRIDO_INICIAL);

    const { recorrido } = registrarClic(t, RECORRIDO_INICIAL, salida, 100);
    expect(recorrido).toEqual({ paso: 1, previo: { punto: salida, t: 100 }, intentos: [] });

    const destino = objetivoDe(t, 1);
    const r2 = registrarClic(t, recorrido, { x: destino.x + 5, y: destino.y }, 1100);
    expect(r2.recorrido.intentos[0]).toEqual({
      n: 10,
      t_inicio_ms: 100,
      t_fin_ms: 1100,
      objetivo: { ...destino, ancho: 60 },
      origen: salida,
      clic: { x: destino.x + 5, y: destino.y },
      acierto: true,
      dpr: 1.5,
    });
  });
});

describe('pantalla de práctica', () => {
  /** Lee la posición del objetivo activo y pulsa cerca (con un desvío) en el área. */
  function pulsarObjetivo(dx = 0) {
    const area = screen.getByRole('application', { name: 'Área de la práctica' });
    const activo = area.querySelector<HTMLElement>('[data-activo]')!;
    const ancho = parseFloat(activo.style.width);
    const x = parseFloat(activo.style.left) + ancho / 2 + dx;
    const y = parseFloat(activo.style.top) + ancho / 2;
    fireEvent.pointerDown(area, { clientX: x, clientY: y });
  }

  test('una práctica completa: dos bloques, intentos enviados y métricas del motor', async () => {
    let ahora = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (ahora += 900));
    usarMotorFalso();
    const { usuario } = renderizarApp('/practica');

    await usuario.selectOptions(screen.getByLabelText('Objetivos por bloque'), '9');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar' }));
    expect(api.sesiones.crear).toHaveBeenCalledWith('practica');

    // Bloque 1: salida + 9 intentos (el último, fuera del objetivo de 80 px).
    expect(await screen.findByText(/Pulsa el objetivo marcado para empezar/)).toBeInTheDocument();
    pulsarObjetivo();
    const desvios = [-12, 8, 0, 15, -6, 3, -9, 11, 60];
    for (const [i, dx] of desvios.entries()) {
      if (i < 8) {
        pulsarObjetivo(dx);
        expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
          `Objetivo ${i + 2} de 9`,
        );
      } else {
        pulsarObjetivo(dx);
      }
    }

    // Entre bloques
    expect(await screen.findByRole('heading', { name: 'Bloque 1 terminado' })).toBeInTheDocument();
    expect(api.sesiones.agregarIntentos).toHaveBeenCalledOnce();
    const bloque1 = vi.mocked(api.sesiones.agregarIntentos).mock.calls[0]![1];
    expect(bloque1).toHaveLength(9);
    expect(bloque1.map((i) => i.acierto)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(bloque1.every((i) => i.objetivo.ancho === 80)).toBe(true);

    // Bloque 2: objetivos de 40 px, numeración continua
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    pulsarObjetivo();
    for (const dx of [-4, 6, 0, 3, -7, 2, -1, 5, 8]) pulsarObjetivo(dx);

    expect(await screen.findByRole('heading', { name: 'Resultados' })).toBeInTheDocument();
    const bloque2 = vi.mocked(api.sesiones.agregarIntentos).mock.calls[1]![1];
    expect(bloque2[0]!.n).toBe(9);
    expect(bloque2.every((i) => i.objetivo.ancho === 40)).toBe(true);

    // Las métricas mostradas son las que devolvió el motor al finalizar...
    expect(api.sesiones.finalizar).toHaveBeenCalledOnce();
    const final = await vi.mocked(api.sesiones.finalizar).mock.results[0]!.value;
    const m = final.metricas!;
    expect(screen.getByText(`${formatoNumero(m.throughput_bps, 2)} bits/s`)).toBeInTheDocument();
    expect(screen.getByText(`${Math.round(m.precision! * 100)} %`)).toBeInTheDocument();
    // ...y coinciden con calcularlas aparte con las fórmulas del motor (ISO 9241-411).
    const todos: Intento[] = [...bloque1, ...bloque2];
    const esperado = calcularMetricas(final.inicio, final.fin, todos, []);
    expect(m.throughput_bps).toBeCloseTo(esperado.throughput_bps!, 9);
    expect(m.precision).toBe(17 / 18);
    expect(m.tiempo_medio_ms).toBeCloseTo(esperado.tiempo_medio_ms!, 9);
  });

  test('compara con la práctica anterior del perfil', async () => {
    usarMotorFalso({ conHistorial: true });
    const { usuario } = renderizarApp('/practica');
    await usuario.selectOptions(screen.getByLabelText('Objetivos por bloque'), '9');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar' }));
    for (let b = 0; b < 2; b += 1) {
      if (b === 1) await usuario.click(await screen.findByRole('button', { name: 'Continuar' }));
      await screen.findByText(/Bloque/);
      for (let i = 0; i < 10; i += 1) pulsarObjetivo(i % 2 ? 5 : -5);
    }

    const resultados = await screen.findByRole('region', { name: 'Resultados' });
    await waitFor(() =>
      expect(within(resultados).getAllByText(/respecto a la vez anterior/).length).toBeGreaterThan(
        0,
      ),
    );
  });

  test('sin perfil activo no deja empezar', () => {
    usarMotorFalso({ sembrado: false });
    renderizarApp('/practica');
    expect(screen.getByText('Elige un perfil para guardar los resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeDisabled();
  });

  test('Detener cierra la sesión y vuelve al inicio', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/practica');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByText(/Pulsa el objetivo marcado/);

    await usuario.click(screen.getByRole('button', { name: 'Detener' }));

    expect(api.sesiones.finalizar).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
  });

  test('si se sale a mitad, la sesión se cierra igual', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/practica');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar' }));
    await screen.findByText(/Pulsa el objetivo marcado/);

    await usuario.click(screen.getByRole('link', { name: 'Inicio' }));
    await act(async () => {});

    expect(api.sesiones.finalizar).toHaveBeenCalledOnce();
  });
});
