import { describe, expect, test } from 'vitest';
import { AA_COMPONENTE, AA_TEXTO, contraste } from './contraste';
import css from './tokens.css?raw';

/** Colores (#rrggbb) definidos en el bloque de un tema de tokens.css. */
function coloresDelTema(tema: 'oscuro' | 'contraste'): Record<string, string> {
  const bloque = new RegExp(`:root\\[data-tema='${tema}'\\]\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!bloque) throw new Error(`No se encontró el tema "${tema}" en tokens.css`);
  return Object.fromEntries(
    [...bloque.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]),
  );
}

const SUPERFICIES = ['fondo', 'superficie', 'superficie-2'];

// [primer plano, fondo, mínimo]: cada par que la interfaz usa junto.
const PARES: [string, string, number][] = [
  // Texto sobre cualquier superficie.
  ...SUPERFICIES.flatMap((s): [string, string, number][] => [
    ['texto', s, AA_TEXTO],
    ['texto-suave', s, AA_TEXTO],
    // Los colores de estado también se usan como texto e iconos.
    ['accion', s, AA_TEXTO],
    ['activo', s, AA_TEXTO],
    ['bien', s, AA_TEXTO],
    ['aviso', s, AA_TEXTO],
    ['mal', s, AA_TEXTO],
    ['apagado', s, AA_TEXTO],
    // Bordes de controles y anillo de foco.
    ['linea', s, AA_COMPONENTE],
    ['foco', s, AA_COMPONENTE],
  ]),
  // Texto sobre rellenos de color.
  ['sobre-accion', 'accion', AA_TEXTO],
  ['sobre-activo', 'activo', AA_TEXTO],
  ['sobre-estado', 'bien', AA_TEXTO],
  ['sobre-estado', 'aviso', AA_TEXTO],
  ['sobre-estado', 'mal', AA_TEXTO],
  ['sobre-estado', 'apagado', AA_TEXTO],
];

describe.each(['oscuro', 'contraste'] as const)('tema %s', (tema) => {
  const colores = coloresDelTema(tema);

  test.each(PARES)('%s sobre %s tiene contraste ≥ %d:1', (frente, fondo, minimo) => {
    const a = colores[frente];
    const b = colores[fondo];
    expect(a, `falta --${frente}`).toBeDefined();
    expect(b, `falta --${fondo}`).toBeDefined();
    expect(contraste(a!, b!)).toBeGreaterThanOrEqual(minimo);
  });
});

test('el tema de alto contraste llega a AAA (7:1) en el texto', () => {
  const c = coloresDelTema('contraste');
  expect(contraste(c['texto']!, c['fondo']!)).toBeGreaterThanOrEqual(7);
  expect(contraste(c['texto-suave']!, c['superficie-2']!)).toBeGreaterThanOrEqual(7);
});

test('contraste() coincide con los valores de referencia de WCAG', () => {
  expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
  expect(contraste('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  expect(contraste('#123456', '#123456')).toBe(1);
});
