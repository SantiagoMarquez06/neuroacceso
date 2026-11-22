import { beforeEach, expect, test } from 'vitest';
import { aplicarApariencia, leerApariencia, useApariencia } from './apariencia';

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset['tema'];
  delete document.documentElement.dataset['texto'];
});

test('por defecto usa el tema oscuro con texto normal', () => {
  expect(leerApariencia()).toEqual({ tema: 'oscuro', texto: 'normal' });
});

test('cambiar la apariencia la aplica al documento y la recuerda', () => {
  useApariencia.getState().cambiar({ tema: 'contraste', texto: 'grande' });

  expect(document.documentElement.dataset['tema']).toBe('contraste');
  expect(document.documentElement.dataset['texto']).toBe('grande');
  expect(leerApariencia()).toEqual({ tema: 'contraste', texto: 'grande' });
});

test('ignora valores guardados que no son válidos', () => {
  localStorage.setItem('neuroacceso.apariencia', '{"tema":"rosa","texto":"enorme"}');
  expect(leerApariencia()).toEqual({ tema: 'oscuro', texto: 'normal' });

  localStorage.setItem('neuroacceso.apariencia', 'esto no es JSON');
  expect(leerApariencia()).toEqual({ tema: 'oscuro', texto: 'normal' });
});

test('aplicarApariencia escribe los atributos que leen los tokens CSS', () => {
  aplicarApariencia({ tema: 'oscuro', texto: 'muy-grande' });
  expect(document.documentElement.dataset['tema']).toBe('oscuro');
  expect(document.documentElement.dataset['texto']).toBe('muy-grande');
});
