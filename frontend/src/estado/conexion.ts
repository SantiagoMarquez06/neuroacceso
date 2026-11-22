// Une el cliente WebSocket con el estado de la interfaz.
import { useEffect, useRef } from 'react';
import { obtenerToken, urlEventos } from '../api/config';
import { ClienteEventos } from '../api/eventos';
import { api, ErrorApi } from '../api/rest';
import type { DatosEvento, Evento, TipoEvento } from '../api/tipos';
import { aplicarEvento, fijarEnlace } from './motor';
import { orientacion } from './orientacion';

type Oyente<K extends TipoEvento> = (datos: DatosEvento[K]) => void;
const oyentes = new Map<TipoEvento, Set<Oyente<TipoEvento>>>();

/**
 * Entrada única de todo evento del motor: actualiza los almacenes y avisa a quien escucha.
 * Las pruebas la llaman directamente para simular lo que enviaría el motor.
 */
export function recibir(evento: Evento): void {
  if (evento.tipo === 'orientacion') orientacion.fijar(evento.datos);
  else aplicarEvento(evento);
  for (const oyente of oyentes.get(evento.tipo) ?? []) oyente(evento.datos);
}

/** Escucha un tipo de evento fuera de React. Devuelve la función para dejar de escuchar. */
export function escuchar<K extends TipoEvento>(tipo: K, oyente: Oyente<K>): () => void {
  const lista = oyentes.get(tipo) ?? new Set();
  oyentes.set(tipo, lista);
  lista.add(oyente as Oyente<TipoEvento>);
  return () => lista.delete(oyente as Oyente<TipoEvento>);
}

/** Ejecuta `alLlegar` con cada evento de ese tipo mientras el componente esté en pantalla. */
export function useEvento<K extends TipoEvento>(tipo: K, alLlegar: Oyente<K>): void {
  const ultimo = useRef(alLlegar);
  useEffect(() => {
    ultimo.current = alLlegar;
  });
  useEffect(() => escuchar(tipo, (datos) => ultimo.current(datos)), [tipo]);
}

export const clienteEventos = new ClienteEventos({
  url: () => {
    const token = obtenerToken();
    return token ? urlEventos(token) : null;
  },
  // El navegador no dice por qué falló un WebSocket: se pregunta por REST. Un 401/403 significa
  // que el token ya no vale (reintentar es inútil); cualquier otra cosa, que el motor no está.
  debeReintentar: async () => {
    try {
      await api.salud();
      return true;
    } catch (error) {
      return !(error instanceof ErrorApi && (error.status === 401 || error.status === 403));
    }
  },
});

let iniciada = false;

/** Arranca la conexión con el motor (una sola vez por ventana). */
export function iniciarConexion(): void {
  if (iniciada) return;
  iniciada = true;
  clienteEventos.enEnlace(fijarEnlace);
  clienteEventos.enTodos(recibir);
  clienteEventos.conectar();
}
