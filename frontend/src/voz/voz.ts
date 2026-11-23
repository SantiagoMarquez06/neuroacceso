// Voz sin internet (docs/pantallas.md §4.4): Web Speech API usando SOLO voces locales en
// español (`localService`), que funcionan con el Wi-Fi apagado. Si no hay ninguna, se usa la
// voz de respaldo del motor (SAPI de Windows) y se avisa cómo instalar una.
import { useEffect, useState } from 'react';
import { api } from '../api/rest';

/** Lo que importa de una voz del sistema (SpeechSynthesisVoice cumple esta forma). */
export interface VozSistema {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/** Voces locales en español, con las de España/Latinoamérica más comunes primero. */
export function vocesLocalesEspanol<V extends VozSistema>(voces: readonly V[]): V[] {
  const preferencia = (v: VozSistema) => (/^es-(ES|MX|US|419)/i.test(v.lang) ? 0 : 1);
  return voces
    .filter((v) => v.localService && v.lang.toLowerCase().startsWith('es'))
    .sort((a, b) => preferencia(a) - preferencia(b) || a.name.localeCompare(b.name, 'es'));
}

/** La voz elegida en los ajustes si sigue instalada; si no, la primera local en español. */
export function elegirVoz<V extends VozSistema>(
  voces: readonly V[],
  vozId: string | null | undefined,
): V | null {
  const locales = vocesLocalesEspanol(voces);
  return locales.find((v) => v.voiceURI === vozId) ?? locales[0] ?? null;
}

/** Velocidad de los ajustes (palabras/min, 50–300; 150 = normal) → `rate` de Web Speech. */
export function tasaDeVelocidad(velocidad: number): number {
  return Math.min(2, Math.max(0.5, Number((velocidad / 150).toFixed(2))));
}

const sintesis = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

/** Voces del sistema. Se cargan de forma asíncrona: el hook avisa cuando llegan o cambian. */
export function useVoces(): SpeechSynthesisVoice[] {
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>(() => sintesis()?.getVoices() ?? []);
  useEffect(() => {
    const s = sintesis();
    if (!s) return;
    const leer = () => setVoces(s.getVoices());
    s.addEventListener('voiceschanged', leer);
    return () => s.removeEventListener('voiceschanged', leer);
  }, []);
  return voces;
}

export type ResultadoVoz = 'local' | 'motor';

/**
 * Dice un texto en voz alta. Con una voz local en español usa el navegador; si no hay, pide al
 * motor su voz de respaldo. Devuelve cuál se usó.
 */
export async function decir(
  texto: string,
  { vozId, velocidad }: { vozId?: string | null; velocidad: number },
): Promise<ResultadoVoz> {
  const limpio = texto.trim();
  if (!limpio) return 'local';
  const s = sintesis();
  const voz = s ? elegirVoz(s.getVoices(), vozId) : null;
  if (!s || !voz) {
    await api.voz.hablar(limpio);
    return 'motor';
  }
  s.cancel(); // lo nuevo reemplaza a lo que se estaba diciendo
  const enunciado = new SpeechSynthesisUtterance(limpio);
  enunciado.voice = voz;
  enunciado.lang = voz.lang;
  enunciado.rate = tasaDeVelocidad(velocidad);
  s.speak(enunciado);
  return 'local';
}

export function callar(): void {
  sintesis()?.cancel();
}

/** Instrucciones para instalar una voz en español en Windows (sin jerga). */
export const AYUDA_INSTALAR_VOZ =
  'Para usar la voz sin internet: abre Configuración de Windows → Hora e idioma → Voz → ' +
  'Agregar voces, y elige una voz en español. Mientras tanto se usa la voz de NeuroAcceso.';
