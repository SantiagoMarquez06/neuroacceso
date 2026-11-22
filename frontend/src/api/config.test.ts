import { afterEach, describe, expect, test } from 'vitest';
import { obtenerToken, tokenDelFragmento, urlEventos, urlRest } from './config';

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('tokenDelFragmento', () => {
  test.each([
    ['#token=abc', 'abc'],
    ['token=abc', 'abc'],
    ['#otra=1&token=a_b-c', 'a_b-c'],
    ['#token=', null],
    ['#sin-token', null],
    ['', null],
  ])('%s → %s', (fragmento, esperado) => {
    expect(tokenDelFragmento(fragmento)).toBe(esperado);
  });
});

describe('obtenerToken', () => {
  test('sin fragmento ni sesión no hay token', () => {
    expect(obtenerToken()).toBeNull();
  });

  test('lo toma del fragmento, lo recuerda y limpia la URL', () => {
    window.history.replaceState(null, '', '/estado?x=1#token=secreto');

    expect(obtenerToken()).toBe('secreto');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname + window.location.search).toBe('/estado?x=1');
    // Tras navegar o recargar ya no está en la URL, pero la ventana lo conserva.
    expect(obtenerToken()).toBe('secreto');
  });

  test('un token nuevo en la URL reemplaza al anterior', () => {
    sessionStorage.setItem('neuroacceso.token', 'viejo');
    window.history.replaceState(null, '', '/#token=nuevo');

    expect(obtenerToken()).toBe('nuevo');
  });
});

describe('direcciones del motor', () => {
  test('la API REST cuelga de /api/v1 en el mismo origen', () => {
    expect(urlRest('/perfiles')).toBe(`${window.location.origin}/api/v1/perfiles`);
  });

  test('el WebSocket usa ws:// y lleva el token', () => {
    const url = new URL(urlEventos('a b&c'));

    expect(url.protocol).toBe('ws:');
    expect(url.host).toBe(window.location.host);
    expect(url.pathname).toBe('/api/v1/eventos');
    expect(url.searchParams.get('token')).toBe('a b&c');
  });
});
