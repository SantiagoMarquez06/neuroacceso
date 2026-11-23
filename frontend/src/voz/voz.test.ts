import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from '../api/rest';
import { decir, elegirVoz, tasaDeVelocidad, vocesLocalesEspanol, type VozSistema } from './voz';

const voz = (voiceURI: string, lang: string, localService = true): VozSistema => ({
  voiceURI,
  name: voiceURI,
  lang,
  localService,
  default: false,
});

const VOCES = [
  voz('Microsoft David', 'en-US'),
  voz('Google español', 'es-ES', false), // en línea: no sirve sin internet
  voz('Microsoft Sabina', 'es-MX'),
  voz('Microsoft Helena', 'es-ES'),
  voz('Microsoft Laura', 'es-CO'),
];

describe('elección de voz', () => {
  test('solo voces locales en español', () => {
    expect(vocesLocalesEspanol(VOCES).map((v) => v.voiceURI)).toEqual([
      'Microsoft Helena',
      'Microsoft Sabina',
      'Microsoft Laura',
    ]);
  });

  test('usa la voz de los ajustes si está instalada y es local', () => {
    expect(elegirVoz(VOCES, 'Microsoft Laura')?.voiceURI).toBe('Microsoft Laura');
  });

  test('si la voz guardada no existe o no es local, usa la primera local en español', () => {
    expect(elegirVoz(VOCES, 'Voz borrada')?.voiceURI).toBe('Microsoft Helena');
    expect(elegirVoz(VOCES, 'Google español')?.voiceURI).toBe('Microsoft Helena');
    expect(elegirVoz(VOCES, null)?.voiceURI).toBe('Microsoft Helena');
  });

  test('sin voces locales en español no hay voz', () => {
    expect(
      elegirVoz([voz('Microsoft David', 'en-US'), voz('Google', 'es-ES', false)], null),
    ).toBeNull();
  });

  test('la velocidad 150 es la normal y se acota a 0,5–2', () => {
    expect(tasaDeVelocidad(150)).toBe(1);
    expect(tasaDeVelocidad(225)).toBe(1.5);
    expect(tasaDeVelocidad(50)).toBe(0.5);
    expect(tasaDeVelocidad(300)).toBe(2);
  });
});

describe('decir', () => {
  afterEach(() => vi.unstubAllGlobals());

  function sintesisCon(voces: VozSistema[]) {
    const hablar = vi.fn();
    const cancelar = vi.fn();
    vi.stubGlobal('speechSynthesis', { getVoices: () => voces, speak: hablar, cancel: cancelar });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        voice: unknown = null;
        lang = '';
        rate = 1;
        constructor(readonly text: string) {}
      },
    );
    return { hablar, cancelar };
  }

  test('con voz local, habla con el navegador (sin internet ni motor)', async () => {
    const { hablar, cancelar } = sintesisCon(VOCES);
    const respaldo = vi.spyOn(api.voz, 'hablar');

    await expect(
      decir('  Tengo sed ', { vozId: 'Microsoft Sabina', velocidad: 180 }),
    ).resolves.toBe('local');

    expect(cancelar).toHaveBeenCalled();
    expect(hablar).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ text: 'Tengo sed', lang: 'es-MX', rate: 1.2 }),
    );
    expect(respaldo).not.toHaveBeenCalled();
  });

  test('sin voz local en español, usa la voz del motor', async () => {
    const { hablar } = sintesisCon([voz('Microsoft David', 'en-US')]);
    const respaldo = vi.spyOn(api.voz, 'hablar').mockResolvedValue(undefined);

    await expect(decir('Hola', { velocidad: 150 })).resolves.toBe('motor');

    expect(respaldo).toHaveBeenCalledWith('Hola');
    expect(hablar).not.toHaveBeenCalled();
  });

  test('un texto vacío no dice nada', async () => {
    const { hablar } = sintesisCon(VOCES);
    await decir('   ', { velocidad: 150 });
    expect(hablar).not.toHaveBeenCalled();
  });
});
