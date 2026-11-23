// Órdenes sobre perfiles, compartidas por Inicio y Perfiles.
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { CLAVES } from '../../api/consultas';
import { api } from '../../api/rest';
import { useMotor } from '../../estado/motor';
import { CONTACTO_BUENO } from '../../estructura/resumen';

export function useOrdenesPerfiles() {
  const consultas = useQueryClient();
  const navegar = useNavigate();
  const refrescar = () => consultas.invalidateQueries({ queryKey: CLAVES.perfiles });

  /**
   * Activa un perfil y lleva a la pantalla adecuada: si falta calibrar o el contacto es bajo,
   * al asistente de preparación; si no, al panel principal.
   */
  const activar = async (perfilId: string) => {
    const estado = await api.perfiles.activar(perfilId);
    await refrescar();
    const calidad = useMotor.getState().dispositivo?.calidad_global ?? 0;
    const listo =
      estado.calibrado && estado.conexion.estado === 'conectado' && calidad >= CONTACTO_BUENO;
    navegar(listo ? '/estado' : '/preparacion');
  };

  const crear = async (nombre: string) => {
    const perfil = await api.perfiles.crear({ nombre });
    await refrescar();
    return perfil;
  };

  const renombrar = async (perfilId: string, nombre: string) => {
    await api.perfiles.editar(perfilId, { nombre });
    await refrescar();
  };

  const eliminar = async (perfilId: string) => {
    await api.perfiles.eliminar(perfilId);
    await Promise.all([refrescar(), consultas.invalidateQueries({ queryKey: ['sesiones'] })]);
  };

  return { activar, crear, renombrar, eliminar };
}
