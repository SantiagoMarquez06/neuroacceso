// Cómo se resume cada sesión en el historial.
import type { Sesion } from '../../api/tipos';
import { formatoDuracion, formatoNumero, formatoPorcentaje } from '../../textos';

export const duracionMs = (s: Sesion): number | null =>
  s.fin ? Date.parse(s.fin) - Date.parse(s.inicio) : null;

/** Resultado principal de una sesión, en una línea ("1,72 bits/s · 93 %", "8,4 caracteres/min"). */
export function resultado(s: Sesion): string {
  const m = s.metricas;
  if (!s.fin) return 'Sin terminar';
  if (!m) return '—';
  if (s.tipo === 'practica') {
    const partes = [];
    if (m.throughput_bps != null) partes.push(`${formatoNumero(m.throughput_bps, 2)} bits/s`);
    if (m.precision != null) partes.push(`${formatoPorcentaje(m.precision)} de aciertos`);
    return partes.join(' · ') || 'Sin intentos';
  }
  if (s.tipo === 'comunicador') {
    return m.caracteres_min == null
      ? 'Sin frases'
      : `${formatoNumero(m.caracteres_min, 1)} caracteres/min`;
  }
  return '—';
}

export const textoDuracion = (s: Sesion) => {
  const ms = duracionMs(s);
  return ms === null ? '—' : formatoDuracion(ms);
};

/** Desde qué fecha mostrar, según el período elegido (en días; 0 = todo). */
export function desdePeriodo(dias: number, ahora = Date.now()): string | undefined {
  if (!dias) return undefined;
  const d = new Date(ahora - dias * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Contenido de un CSV listo para descargar, con BOM para que Excel lea bien las tildes. */
export function descargar(
  nombre: string,
  contenido: string,
  tipo = 'text/csv;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob(['﻿', contenido], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
