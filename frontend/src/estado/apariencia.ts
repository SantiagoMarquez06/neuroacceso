// Apariencia: tema y tamaño del texto. Es local de la interfaz (no pasa por el motor) y se
// recuerda en este equipo.
import { create } from 'zustand';

export type Tema = 'oscuro' | 'contraste';
export type TamanoTexto = 'normal' | 'grande' | 'muy-grande';

export interface Apariencia {
  tema: Tema;
  texto: TamanoTexto;
}

const CLAVE = 'neuroacceso.apariencia';
const TEMAS: Tema[] = ['oscuro', 'contraste'];
const TAMANOS: TamanoTexto[] = ['normal', 'grande', 'muy-grande'];

function porDefecto(): Apariencia {
  // Si el sistema operativo pide más contraste, se respeta desde el primer arranque.
  const pideContraste =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-contrast: more)').matches;
  return { tema: pideContraste ? 'contraste' : 'oscuro', texto: 'normal' };
}

export function leerApariencia(): Apariencia {
  const base = porDefecto();
  try {
    const guardada: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (guardada && typeof guardada === 'object') {
      const { tema, texto } = guardada as Partial<Apariencia>;
      if (tema && TEMAS.includes(tema)) base.tema = tema;
      if (texto && TAMANOS.includes(texto)) base.texto = texto;
    }
  } catch {
    // Sin almacenamiento o con datos dañados: se usan los valores por defecto.
  }
  return base;
}

/** Aplica la apariencia al documento: los tokens CSS reaccionan a estos atributos. */
export function aplicarApariencia({ tema, texto }: Apariencia): void {
  document.documentElement.dataset['tema'] = tema;
  document.documentElement.dataset['texto'] = texto;
}

interface EstadoApariencia extends Apariencia {
  cambiar: (cambios: Partial<Apariencia>) => void;
}

export const useApariencia = create<EstadoApariencia>((set, get) => ({
  ...leerApariencia(),
  cambiar: (cambios) => {
    set(cambios);
    const { tema, texto } = get();
    aplicarApariencia({ tema, texto });
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ tema, texto }));
    } catch {
      // No se pudo guardar: el cambio vale solo para esta sesión.
    }
  },
}));
