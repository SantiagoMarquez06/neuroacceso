import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  atras,
  avanzar,
  INICIAL,
  normalizar,
  resaltadoDe,
  seleccionar,
  type EstadoBarrido,
} from './barrido';
import { useBarrido } from './useBarrido';

// Tres grupos: frases (3), una fila de 4 teclas y un grupo de un solo botón.
const T = [3, 4, 1];
const enGrupo = (grupo: number): EstadoBarrido => ({ nivel: 'grupos', grupo, elemento: 0 });
const enElemento = (grupo: number, elemento: number): EstadoBarrido => ({
  nivel: 'elementos',
  grupo,
  elemento,
});

describe('lógica pura', () => {
  test('1. el reloj recorre los grupos en orden y vuelve a empezar', () => {
    let e = INICIAL;
    const vistos = [e.grupo];
    for (let i = 0; i < 4; i += 1) vistos.push((e = avanzar(e, T)).grupo);
    expect(vistos).toEqual([0, 1, 2, 0, 1]);
  });

  test('2. seleccionar entra en el grupo y resalta su primer elemento', () => {
    expect(seleccionar(enGrupo(1), T)).toEqual({ estado: enElemento(1, 0), activado: null });
  });

  test('el reloj recorre los elementos del grupo', () => {
    expect(avanzar(enElemento(1, 0), T)).toEqual(enElemento(1, 1));
    expect(avanzar(enElemento(1, 2), T)).toEqual(enElemento(1, 3));
  });

  test('3. seleccionar activa el elemento y vuelve al primer grupo', () => {
    expect(seleccionar(enElemento(1, 2), T)).toEqual({
      estado: enGrupo(0),
      activado: { grupo: 1, elemento: 2 },
    });
  });

  test('4. si recorre el grupo entero sin selección, vuelve al nivel de grupos', () => {
    expect(avanzar(enElemento(1, 3), T)).toEqual(enGrupo(1));
  });

  test('5. atrás sube un nivel', () => {
    expect(atras(enElemento(1, 2), T)).toEqual(enGrupo(1));
    expect(atras(enGrupo(2), T)).toEqual(enGrupo(0));
  });

  test('un grupo de un solo elemento se activa sin entrar en él', () => {
    expect(seleccionar(enGrupo(2), T)).toEqual({
      estado: enGrupo(0),
      activado: { grupo: 2, elemento: 0 },
    });
  });

  test('los grupos vacíos se saltan', () => {
    const conVacio = [2, 0, 3];
    expect(avanzar(enGrupo(0), conVacio)).toEqual(enGrupo(2));
    expect(normalizar(enGrupo(1), conVacio)).toEqual(enGrupo(2));
  });

  test('sin ningún elemento no hace nada', () => {
    expect(avanzar(INICIAL, [0, 0])).toEqual(INICIAL);
    expect(seleccionar(INICIAL, [])).toEqual({ estado: INICIAL, activado: null });
  });

  test('si el grupo encoge (menos sugerencias), el resaltado no apunta a la nada', () => {
    expect(normalizar(enElemento(0, 2), [2, 4])).toEqual(enGrupo(0));
  });

  test('resaltadoDe marca el grupo entero o solo el elemento activo', () => {
    expect([0, 1, 2].map((e) => resaltadoDe(enGrupo(0), 0, e))).toEqual([
      'grupo',
      'grupo',
      'grupo',
    ]);
    expect(resaltadoDe(enGrupo(0), 1, 0)).toBeUndefined();
    expect([0, 1, 2].map((e) => resaltadoDe(enElemento(0, 1), 0, e))).toEqual([
      undefined,
      'activo',
      undefined,
    ]);
  });
});

describe('useBarrido (con reloj)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function montar(tiempoMs = 1000, tamanos = T) {
    const alActivar = vi.fn();
    const hook = renderHook(
      ({ activo }: { activo: boolean }) => useBarrido(tamanos, { tiempoMs, alActivar, activo }),
      { initialProps: { activo: true } },
    );
    const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
    return { ...hook, alActivar, pasar };
  }

  test('avanza un grupo cada tiempoMs', () => {
    const { result, pasar } = montar(1200);
    expect(result.current.estado).toEqual(enGrupo(0));

    pasar(1199);
    expect(result.current.estado.grupo).toBe(0);
    pasar(1);
    expect(result.current.estado.grupo).toBe(1);
    pasar(1200);
    expect(result.current.estado.grupo).toBe(2);
  });

  test('escribe con dos selecciones: entrar al grupo y elegir el elemento', async () => {
    const { result, pasar, alActivar } = montar();
    pasar(1000); // grupo 1

    act(() => result.current.seleccionar());
    expect(result.current.estado).toEqual(enElemento(1, 0));
    pasar(2000); // elemento 2

    act(() => result.current.seleccionar());
    await act(async () => {}); // la activación se avisa en una microtarea

    expect(alActivar).toHaveBeenCalledExactlyOnceWith({ grupo: 1, elemento: 2 });
    expect(result.current.estado).toEqual(enGrupo(0));
  });

  test('cada selección da el tiempo completo sobre lo nuevo', () => {
    const { result, pasar } = montar(1000);
    pasar(900);
    act(() => result.current.seleccionar()); // entra al grupo 0 casi al final del tiempo

    pasar(900);
    expect(result.current.estado).toEqual(enElemento(0, 0)); // todavía en el primero
    pasar(100);
    expect(result.current.estado).toEqual(enElemento(0, 1));
  });

  test('recorrer un grupo sin elegir vuelve a los grupos', () => {
    const { result, pasar } = montar();
    act(() => result.current.seleccionar()); // grupo 0 (3 elementos)

    pasar(3000);

    expect(result.current.estado).toEqual(enGrupo(0));
  });

  test('atrás sube un nivel', () => {
    const { result, pasar } = montar();
    pasar(1000);
    act(() => result.current.seleccionar());

    act(() => result.current.atras());

    expect(result.current.estado).toEqual(enGrupo(1));
  });

  test('inactivo: el resaltado se para y no acepta selecciones', async () => {
    const { result, pasar, rerender, alActivar } = montar();
    rerender({ activo: false });

    pasar(5000);
    act(() => result.current.seleccionar());
    await act(async () => {});

    expect(result.current.estado).toEqual(enGrupo(0));
    expect(result.current.resaltado(0, 0)).toBeUndefined();
    expect(alActivar).not.toHaveBeenCalled();
  });
});
