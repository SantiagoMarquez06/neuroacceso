// Predicción de palabras en español (docs/pantallas.md §4.4, issue #39).
//
// Fuente: lista de palabras frecuentes + las que ya usó este perfil (pesan más). Se busca sin
// distinguir tildes porque el teclado de barrido no las tiene: "ESTA" sugiere "ESTÁ". La Ñ sí es
// una letra distinta: "ANO" no sugiere "AÑO".
import { PALABRAS_FRECUENTES } from './frecuencias';

export const MAX_SUGERENCIAS = 4;

/** Mayúsculas y sin tildes ni diéresis, conservando la Ñ. */
export function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[́̈̀]/g, '') // tilde aguda, diéresis y grave; NO la virgulilla de la Ñ
    .normalize('NFC');
}

/** Palabra que se está escribiendo (lo que hay tras el último espacio o signo). */
export function palabraEnCurso(texto: string): string {
  return /[\p{L}]*$/u.exec(texto)?.[0] ?? '';
}

/** Historial de un perfil: cuántas veces usó cada palabra. */
export type Historial = Record<string, number>;

const RANGO = new Map(PALABRAS_FRECUENTES.map((palabra, i) => [palabra, i]));

/** Puntuación de una palabra: el uso del perfil manda; después, la frecuencia general. */
function puntuacion(palabra: string, historial: Historial): number {
  const usos = historial[palabra] ?? 0;
  const rango = RANGO.get(palabra) ?? PALABRAS_FRECUENTES.length;
  return usos * 1000 - rango;
}

/**
 * Hasta `max` palabras que completan lo que se está escribiendo. Sin nada escrito en la palabra
 * actual, propone las más usadas por el perfil (o las más frecuentes del idioma).
 */
export function sugerir(texto: string, historial: Historial = {}, max = MAX_SUGERENCIAS): string[] {
  const prefijo = normalizar(palabraEnCurso(texto));
  const candidatas = new Set([...Object.keys(historial), ...PALABRAS_FRECUENTES]);
  return [...candidatas]
    .filter((palabra) => {
      const n = normalizar(palabra);
      // Una palabra ya escrita entera no se sugiere (salvo que lleve una tilde que falta).
      return n.startsWith(prefijo) && palabra !== palabraEnCurso(texto).toUpperCase();
    })
    .sort((a, b) => puntuacion(b, historial) - puntuacion(a, historial))
    .slice(0, max);
}

/** Cambia la palabra en curso por la sugerencia y añade un espacio. */
export function completar(texto: string, sugerencia: string): string {
  return texto.slice(0, texto.length - palabraEnCurso(texto).length) + sugerencia + ' ';
}

/** Suma al historial las palabras de un texto (en mayúsculas, como las muestra el teclado). */
export function aprender(historial: Historial, texto: string): Historial {
  const nuevo = { ...historial };
  for (const palabra of texto.toUpperCase().match(/\p{L}+/gu) ?? []) {
    if (palabra.length >= 2) nuevo[palabra] = (nuevo[palabra] ?? 0) + 1;
  }
  return nuevo;
}

// ---- Historial guardado en este equipo, por perfil ---------------------------------------------
const clave = (perfilId: string) => `neuroacceso.palabras.${perfilId}`;

export function leerHistorial(perfilId: string | null | undefined): Historial {
  if (!perfilId) return {};
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(clave(perfilId)) ?? '{}');
    if (!valor || typeof valor !== 'object') return {};
    return Object.fromEntries(
      Object.entries(valor).filter(([, n]) => typeof n === 'number' && n > 0),
    ) as Historial;
  } catch {
    return {};
  }
}

export function guardarHistorial(perfilId: string | null | undefined, historial: Historial): void {
  if (!perfilId) return;
  try {
    localStorage.setItem(clave(perfilId), JSON.stringify(historial));
  } catch {
    // Sin almacenamiento: la predicción sigue funcionando con la lista general.
  }
}
