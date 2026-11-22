// Contraste de color según WCAG 2.x (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio).

/** Luminancia relativa de un color #rrggbb. */
export function luminancia(hex: string): number {
  const limpio = hex.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(limpio)) throw new Error(`Color no válido: ${hex}`);
  const canal = (desde: number) => {
    const c = parseInt(limpio.slice(desde, desde + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

/** Relación de contraste entre dos colores: de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (clara + 0.05) / (oscura + 0.05);
}

/** Mínimos de WCAG AA. */
export const AA_TEXTO = 4.5;
export const AA_COMPONENTE = 3;
