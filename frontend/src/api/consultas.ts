// Consultas REST con caché (TanStack Query). El estado en tiempo real NO va aquí: llega por el
// WebSocket a los almacenes de src/estado.
import { QueryClient, useQuery } from '@tanstack/react-query';
import { useMotor } from '../estado/motor';
import { api, ErrorApi, type FiltroSesiones } from './rest';
import type { Perfil } from './tipos';

export const CLAVES = {
  salud: ['salud'] as const,
  perfiles: ['perfiles'] as const,
  ajustes: (perfilId: string) => ['ajustes', perfilId] as const,
  gestos: ['gestos'] as const,
  sesiones: (filtro: FiltroSesiones = {}) => ['sesiones', filtro] as const,
  sesion: (sesionId: string) => ['sesion', sesionId] as const,
};

export function crearClienteConsultas({ reintentos = true } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Solo vale la pena reintentar si el motor no respondió; un 404 o un 409 no cambian solos.
        retry: (fallos, error) =>
          reintentos && fallos < 2 && error instanceof ErrorApi && error.status === 0,
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Versión del motor y si corre en modo demo (casco simulado). */
export const useSalud = () =>
  useQuery({ queryKey: CLAVES.salud, queryFn: api.salud, staleTime: Infinity });

export const usePerfiles = () =>
  useQuery({ queryKey: CLAVES.perfiles, queryFn: api.perfiles.listar });

/** Perfil activo según el motor, o `undefined` si no hay ninguno (o aún no se sabe). */
export function usePerfilActivo(): Perfil | undefined {
  const activoId = useMotor((s) => s.estado?.perfil_activo_id);
  const { data } = usePerfiles();
  return data?.find((perfil) => perfil.id === activoId);
}

export const useGestosDisponibles = () =>
  useQuery({ queryKey: CLAVES.gestos, queryFn: api.gestosDisponibles, staleTime: Infinity });

export const useSesiones = (filtro: FiltroSesiones, activa = true) =>
  useQuery({
    queryKey: CLAVES.sesiones(filtro),
    queryFn: () => api.sesiones.listar(filtro),
    enabled: activa,
  });

export const useSesion = (sesionId: string) =>
  useQuery({ queryKey: CLAVES.sesion(sesionId), queryFn: () => api.sesiones.obtener(sesionId) });
