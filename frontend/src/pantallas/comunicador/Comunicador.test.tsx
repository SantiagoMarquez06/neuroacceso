import { act, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import type { MotorFalso } from '../../mocks/motorFalso';

const hablado = vi.fn();

function vozInstalada(lang = 'es-ES', localService = true) {
  const voces = [{ voiceURI: 'Helena', name: 'Helena', lang, localService, default: true }];
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voces,
    speak: (u: { text: string }) => hablado(u.text),
    cancel: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(readonly text: string) {}
    },
  );
}

beforeEach(() => {
  reiniciarMotor();
  hablado.mockReset();
  localStorage.clear();
  vozInstalada();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const textoEscrito = () => screen.getByRole('status', { name: 'Texto escrito' });
const fila = (n: number) => screen.getByRole('group', { name: `Fila ${n} del teclado` });

/** Entra al comunicador; el motor (falso) pasa a modo comunicador como haría el real. */
async function abrir(opciones: Parameters<typeof usarMotorFalso>[0] = {}) {
  const motor = usarMotorFalso(opciones);
  const app = renderizarApp('/comunicador');
  await act(async () => {}); // la petición PUT /modo se resuelve
  return { motor, ...app };
}

describe('entrar y salir', () => {
  test('al entrar pide el modo comunicador; al salir, vuelve a cursor', async () => {
    const { motor, usuario, rutaActual } = await abrir();
    expect(api.cambiarModo).toHaveBeenCalledWith('comunicador');
    expect(motor.estado.modo).toBe('comunicador');

    await usuario.click(
      within(screen.getByRole('group', { name: 'Controles' })).getByRole('button', {
        name: 'Salir',
      }),
    );
    await act(async () => {});

    expect(rutaActual()).toBe('/estado');
    expect(api.cambiarModo).toHaveBeenLastCalledWith('cursor');
    expect(motor.estado.modo).toBe('cursor');
  });

  test('si el motor no está en comunicador explica que el barrido está detenido y cómo activarlo', async () => {
    const { motor, usuario } = await abrir();
    act(() => void motor.cambiarModo('pausa'));

    expect(screen.getByText('El barrido está detenido')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Activar el barrido' }));

    expect(motor.estado.modo).toBe('comunicador');
    expect(screen.queryByText('El barrido está detenido')).not.toBeInTheDocument();
  });

  test('sin casco se puede escribir con el ratón', async () => {
    const { motor, usuario } = await abrir();
    act(() => motor.fallarConexion('SIN_CASCO', 'No hay casco'));

    expect(screen.getByText('Sin casco, el barrido está detenido')).toBeInTheDocument();
    await usuario.click(within(fila(1)).getByRole('button', { name: 'A' }));
    expect(textoEscrito()).toHaveTextContent('A');
  });
});

describe('escribir y hablar', () => {
  test('con el ratón: letras, espacio, borrar y hablar', async () => {
    const { usuario } = await abrir();
    const controles = screen.getByRole('group', { name: 'Controles' });
    const tecla = async (letra: string) => {
      const boton = screen
        .getAllByRole('button', { name: letra })
        .find((b) => b.closest('[aria-label^="Fila"]'));
      await usuario.click(boton!);
    };

    for (const letra of 'HOLX') await tecla(letra);
    await usuario.click(within(controles).getByRole('button', { name: 'Borrar' }));
    await tecla('A');
    await usuario.click(within(controles).getByRole('button', { name: 'Espacio' }));
    expect(textoEscrito()).toHaveTextContent('HOLA');

    await usuario.click(within(controles).getByRole('button', { name: 'Hablar' }));
    await act(async () => {});

    expect(hablado).toHaveBeenCalledWith('HOLA');
    expect(api.sesiones.crear).toHaveBeenCalledWith('comunicador');
    expect(api.sesiones.agregarEnunciado).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ texto: 'HOLA', selecciones: 8, correcciones: 1 }),
    );
  });

  test('las sugerencias completan la palabra', async () => {
    const { usuario } = await abrir();
    // ABC: A en la fila 1, G en la 2, U en la 4.
    for (const [n, letra] of [
      [1, 'A'],
      [2, 'G'],
      [4, 'U'],
    ] as const) {
      await usuario.click(within(fila(n)).getByRole('button', { name: letra }));
    }
    const sugeridas = screen.getByRole('group', { name: 'Palabras sugeridas' });

    await usuario.click(within(sugeridas).getByRole('button', { name: 'AGUA' }));

    expect(textoEscrito()).toHaveTextContent('AGUA');
    expect(textoEscrito().textContent).toBe('AGUA ');
  });

  test('una frase rápida se dice al momento', async () => {
    const { usuario } = await abrir();

    await usuario.click(
      within(screen.getByRole('group', { name: 'Frases rápidas' })).getByRole('button', {
        name: 'Tengo sed',
      }),
    );

    expect(hablado).toHaveBeenCalledWith('Tengo sed');
    expect(api.sesiones.agregarEnunciado).not.toHaveBeenCalled();
  });

  test('las frases rápidas salen de los ajustes del perfil', async () => {
    const motor: MotorFalso = usarMotorFalso();
    const ajustes = motor.obtenerAjustes(motor.estado.perfil_activo_id!);
    ajustes.comunicador.frases = ['Quiero ver a mi hija', 'Cambia el canal'];
    motor.guardarAjustes(motor.estado.perfil_activo_id!, ajustes);
    renderizarApp('/comunicador');

    const frases = screen.getByRole('group', { name: 'Frases rápidas' });
    expect(
      within(frases)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Quiero ver a mi hija', 'Cambia el canal']);
  });

  test('la disposición por frecuencia pone primero las letras más usadas', async () => {
    const motor = usarMotorFalso();
    const ajustes = motor.obtenerAjustes(motor.estado.perfil_activo_id!);
    ajustes.comunicador.disposicion = 'frecuencia';
    motor.guardarAjustes(motor.estado.perfil_activo_id!, ajustes);
    renderizarApp('/comunicador');

    expect(
      within(fila(1))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['E', 'A', 'O', 'S', 'R', 'N']);
  });

  test('aprende las palabras del perfil para sugerirlas después', async () => {
    const { usuario } = await abrir();
    // ABC: Ñ en la fila 3, U en la 4, Y en la 5.
    for (const [n, letra] of [
      [3, 'Ñ'],
      [4, 'U'],
      [5, 'Y'],
    ] as const) {
      await usuario.click(within(fila(n)).getByRole('button', { name: letra }));
    }
    await usuario.click(
      within(screen.getByRole('group', { name: 'Controles' })).getByRole('button', {
        name: 'Hablar',
      }),
    );
    await act(async () => {});

    expect(JSON.parse(localStorage.getItem('neuroacceso.palabras.p-1') ?? '{}')).toEqual({
      ÑUY: 1,
    });
  });

  test('sin voz local en español avisa cómo instalarla y usa la voz del motor', async () => {
    vozInstalada('en-US');
    const { usuario } = await abrir();

    expect(
      screen.getByText('No hay una voz en español instalada en este equipo'),
    ).toBeInTheDocument();
    await usuario.click(
      within(screen.getByRole('group', { name: 'Frases rápidas' })).getByRole('button', {
        name: 'Sí',
      }),
    );

    expect(api.voz.hablar).toHaveBeenCalledWith('Sí');
    expect(hablado).not.toHaveBeenCalled();
  });
});

describe('solo con gestos (barrido)', () => {
  test('escribe "A" y la dice usando solo el gesto de seleccionar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { motor } = await abrir();
    const pasar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
    const gesto = async () => {
      vi.setSystemTime(Date.now() + 2000); // respeta el tiempo entre acciones del motor
      act(() => motor.simularGesto('clench')); // mapeado a `seleccionar` en el comunicador
      await act(async () => {});
    };

    // Grupos: frases (0) · sugerencias (1) · filas 1–5 (2–6) · controles (7)
    expect(screen.getByRole('group', { name: 'Frases rápidas' })).toHaveAttribute(
      'data-barrido',
      'grupo',
    );
    pasar(1200 * 2);
    expect(fila(1)).toHaveAttribute('data-barrido', 'grupo');

    await gesto(); // entra en la fila 1
    expect(within(fila(1)).getByRole('button', { name: 'A' })).toHaveAttribute(
      'data-barrido',
      'activo',
    );
    await gesto(); // elige la A
    expect(textoEscrito()).toHaveTextContent('A');

    pasar(1200 * 7); // hasta los controles
    expect(screen.getByRole('group', { name: 'Controles' })).toHaveAttribute(
      'data-barrido',
      'grupo',
    );
    await gesto(); // entra en los controles
    pasar(1200 * 2); // Espacio → Borrar → Hablar
    await gesto();

    expect(hablado).toHaveBeenCalledWith('A');
  });

  test('en desarrollo, la barra espaciadora también selecciona', async () => {
    const { usuario } = await abrir();

    await usuario.keyboard(' ');

    expect(screen.getByRole('group', { name: 'Frases rápidas' })).toHaveAttribute(
      'data-barrido',
      'activo',
    );
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('group', { name: 'Frases rápidas' })).toHaveAttribute(
      'data-barrido',
      'grupo',
    );
  });

  test('al salir sin decir nada no deja una sesión vacía', async () => {
    const { usuario } = await abrir();
    await usuario.click(
      within(screen.getByRole('group', { name: 'Controles' })).getByRole('button', {
        name: 'Salir',
      }),
    );
    expect(api.sesiones.crear).not.toHaveBeenCalled();
  });

  test('al salir tras hablar, cierra la sesión (el motor calcula caracteres/min)', async () => {
    const { usuario } = await abrir();
    const controles = () => within(screen.getByRole('group', { name: 'Controles' }));
    await usuario.click(within(fila(1)).getByRole('button', { name: 'B' }));
    await usuario.click(controles().getByRole('button', { name: 'Hablar' }));
    await act(async () => {});

    await usuario.click(controles().getByRole('button', { name: 'Salir' }));
    await act(async () => {});

    expect(api.sesiones.finalizar).toHaveBeenCalledOnce();
  });
});
