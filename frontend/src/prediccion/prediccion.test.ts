import { beforeEach, describe, expect, test } from 'vitest';
import { INICIAL, avanzar, seleccionar, type EstadoBarrido } from '../barrido/barrido';
import { filasTeclado, gruposDeBarrido } from '../pantallas/comunicador/teclado';
import {
  aprender,
  completar,
  guardarHistorial,
  leerHistorial,
  normalizar,
  palabraEnCurso,
  sugerir,
} from './prediccion';

describe('sugerencias', () => {
  test('completa la palabra en curso con las más frecuentes primero', () => {
    expect(sugerir('TENGO SED Y QUIERO AGU')).toEqual(['AGUA', 'AGUACATE']);
    expect(sugerir('DO')[0]).toBe('DOLOR');
  });

  test('sin tildes en el teclado, sugiere la palabra bien escrita', () => {
    expect(sugerir('ESTA')).toContain('ESTÁ');
    expect(sugerir('BAÑ')).toContain('BAÑO');
    expect(sugerir('MAMA')).toEqual(['MAMÁ']);
  });

  test('la Ñ es una letra distinta de la N', () => {
    expect(sugerir('AÑ')).toContain('AÑO');
    expect(sugerir('ANO')).not.toContain('AÑO');
  });

  test('las palabras que ya usó el perfil van primero', () => {
    expect(sugerir('A', { AGUACATE: 3 })[0]).toBe('AGUACATE');
    expect(sugerir('LU', { LUCÍA: 2 })).toContain('LUCÍA');
  });

  test('no sugiere la misma palabra ya escrita entera', () => {
    expect(sugerir('AGUA')).not.toContain('AGUA');
  });

  test('devuelve como mucho 4 sugerencias', () => {
    expect(sugerir('')).toHaveLength(4);
  });

  test('completar reemplaza la palabra en curso y añade un espacio', () => {
    expect(completar('TENGO SED Y QUIERO AGU', 'AGUA')).toBe('TENGO SED Y QUIERO AGUA ');
    expect(completar('', 'HOLA')).toBe('HOLA ');
    expect(completar('HOLA ', 'MAMÁ')).toBe('HOLA MAMÁ ');
  });

  test('utilidades de texto', () => {
    expect(palabraEnCurso('HOLA MA')).toBe('MA');
    expect(palabraEnCurso('HOLA, ')).toBe('');
    expect(normalizar('Está bañándose')).toBe('ESTA BAÑANDOSE');
  });
});

describe('historial del perfil', () => {
  beforeEach(() => localStorage.clear());

  test('aprende las palabras de lo que se dijo', () => {
    expect(aprender({ AGUA: 1 }, 'Quiero agua, por favor')).toEqual({
      AGUA: 2,
      QUIERO: 1,
      POR: 1,
      FAVOR: 1,
    });
  });

  test('se guarda por perfil en este equipo', () => {
    guardarHistorial('p-1', { HOLA: 2 });
    expect(leerHistorial('p-1')).toEqual({ HOLA: 2 });
    expect(leerHistorial('p-2')).toEqual({});
    expect(leerHistorial(null)).toEqual({});
  });

  test('datos dañados no rompen la predicción', () => {
    localStorage.setItem('neuroacceso.palabras.p-1', '{"HOLA":"mucho","AGUA":3}');
    expect(leerHistorial('p-1')).toEqual({ AGUA: 3 });
    localStorage.setItem('neuroacceso.palabras.p-1', 'no es JSON');
    expect(leerHistorial('p-1')).toEqual({});
  });
});

/**
 * "Terminado cuando: reduce selecciones medidas en una frase de prueba" (issue #39).
 * Simula escribir con barrido, con la estrategia más sencilla: elegir la palabra en cuanto
 * aparece entre las sugerencias. Cuenta gestos (selecciones) y pasos de espera del barrido.
 */
describe('reduce el esfuerzo de escribir una frase', () => {
  function escribir(frase: string, conPrediccion: boolean) {
    const filas = filasTeclado('frecuencia');
    const grupos = gruposDeBarrido(filas.length);
    let texto = '';
    let selecciones = 0;
    let pasos = 0;

    const tamanos = () =>
      grupos.map(
        (g) =>
          g.tipo === 'fila'
            ? (filas[g.fila]?.length ?? 0)
            : g.tipo === 'prediccion'
              ? conPrediccion
                ? sugerir(texto).length
                : 0
              : g.tipo === 'controles'
                ? 5
                : 0, // las frases rápidas no se usan en esta prueba
      );

    /** Lleva el barrido hasta (grupo, elemento) y lo elige; cuenta pasos y selecciones. */
    function elegir(grupo: number, elemento: number) {
      let e: EstadoBarrido = { ...INICIAL };
      const t = tamanos();
      while (e.grupo !== grupo) {
        e = avanzar(e, t);
        pasos += 1;
      }
      const r1 = seleccionar(e, t);
      selecciones += 1;
      if (r1.activado) return;
      e = r1.estado;
      while (e.elemento !== elemento) {
        e = avanzar(e, t);
        pasos += 1;
      }
      selecciones += 1;
    }

    const indiceGrupo = (tipo: string, fila?: number) =>
      grupos.findIndex(
        (g) => g.tipo === tipo && (fila === undefined || ('fila' in g && g.fila === fila)),
      );

    while (texto.trimEnd() !== frase) {
      // Palabra completa que se está escribiendo (desde su comienzo en la frase).
      const inicio = texto.length - palabraEnCurso(texto).length;
      const objetivo = frase.slice(inicio).split(' ')[0] ?? '';
      const i = conPrediccion ? sugerir(texto).indexOf(objetivo) : -1;
      if (objetivo && i >= 0) {
        elegir(indiceGrupo('prediccion'), i);
        texto = completar(texto, objetivo);
        continue;
      }
      const letra = frase[texto.length]!;
      if (letra === ' ') {
        elegir(indiceGrupo('controles'), 0);
        texto += ' ';
        continue;
      }
      const fila = filas.findIndex((f) => f.includes(letra));
      elegir(indiceGrupo('fila', fila), filas[fila]!.indexOf(letra));
      texto += letra;
    }
    return { selecciones, pasos };
  }

  test('"TENGO SED Y QUIERO AGUA": menos gestos y menos espera con predicción', () => {
    const frase = 'TENGO SED Y QUIERO AGUA';
    const sin = escribir(frase, false);
    const con = escribir(frase, true);

    expect(sin.selecciones).toBe(46); // 23 caracteres × 2 gestos (entrar en la fila y elegir)
    expect(con.selecciones).toBeLessThan(sin.selecciones * 0.6);
    expect(con.pasos).toBeLessThan(sin.pasos);
  });
});
