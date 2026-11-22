import { useEffect, useRef } from 'react';
import type { EvOrientacion } from '../api/tipos';
import { orientacion, posicionPunto } from '../estado/orientacion';
import estilos from './IndicadorOrientacion.module.css';

const conSigno = (grados: number) =>
  `${grados > 0 ? '+' : grados < 0 ? '−' : ''}${Math.abs(Math.round(grados))}°`;

/**
 * Hacia dónde apunta la cabeza. Se actualiza hasta 20 veces por segundo escribiendo
 * directamente en el DOM: así no se vuelve a dibujar el resto de la pantalla.
 */
export function IndicadorOrientacion() {
  const punto = useRef<HTMLSpanElement>(null);
  const texto = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pintar = (o: EvOrientacion) => {
      const { x, y } = posicionPunto(o);
      if (punto.current) {
        punto.current.style.transform = `translate(${x * 50}%, ${y * 50}%)`;
        punto.current.dataset['calibrado'] = String(o.calibrado);
      }
      if (texto.current) {
        texto.current.textContent = `Giro ${conSigno(o.yaw)} · Inclinación ${conSigno(o.pitch)}`;
      }
    };
    pintar(orientacion.leer());
    return orientacion.suscribir(pintar);
  }, []);

  return (
    <div className={estilos.orientacion}>
      <div className={estilos.recuadro} aria-hidden="true">
        <span className={estilos.pista} ref={punto}>
          <span className={estilos.punto} />
        </span>
      </div>
      {/* No es una región viva: cambiaría demasiado seguido para un lector de pantalla. */}
      <span className={`${estilos.texto} numeros`} ref={texto} />
    </div>
  );
}
