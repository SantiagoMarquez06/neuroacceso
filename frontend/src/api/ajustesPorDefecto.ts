// Ajustes por defecto del motor, tal como los publica el contrato (contrato/ejemplos/rest).
// Se usan mientras aún no han llegado los del perfil activo y para "Restablecer".
import ejemplo from '@contrato/ejemplos/rest/ajustes.json';
import type { Ajustes } from './tipos';

export const AJUSTES_POR_DEFECTO: Ajustes = Object.freeze(ejemplo as Ajustes);

/** Copia editable de los ajustes por defecto. */
export const ajustesPorDefecto = (): Ajustes => structuredClone(ejemplo as Ajustes);
