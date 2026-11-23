// Encuesta SUS al terminar las pruebas con un voluntario (docs/protocolo-pruebas.md §7).
// La rellena el participante con ayuda del acompañante; se guarda en este equipo y se exporta
// en CSV junto con las métricas de las sesiones.
import { useState } from 'react';
import { usePerfilActivo } from '../../api/consultas';
import { Aviso, BotonGrande, CampoTexto, Tarjeta } from '../../componentes';
import { avisar } from '../../estado/avisos';
import { Pantalla } from '../../estructura/Pantalla';
import { formatoNumero } from '../../textos';
import { descargar } from '../historial/resumen';
import estilos from './Encuesta.module.css';
import {
  encuestasCsv,
  guardarEncuesta,
  interpretarSUS,
  leerEncuestas,
  PREGUNTAS_SUS,
  puntuacionSUS,
  type Respuestas,
} from './sus';

const ESCALA = [
  [1, 'Totalmente en desacuerdo'],
  [2, 'En desacuerdo'],
  [3, 'Ni de acuerdo ni en desacuerdo'],
  [4, 'De acuerdo'],
  [5, 'Totalmente de acuerdo'],
] as const;

const vacias = (): Respuestas => Array<number | null>(10).fill(null);

export function Encuesta() {
  const perfil = usePerfilActivo();
  const [participante, setParticipante] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState<Respuestas>(vacias);
  const [guardadas, setGuardadas] = useState(leerEncuestas);
  const codigo = participante ?? perfil?.nombre ?? '';
  const puntuacion = puntuacionSUS(respuestas);
  const faltan = respuestas.filter((r) => r === null).length;

  const guardar = () => {
    if (puntuacion === null || !codigo.trim()) return;
    setGuardadas(
      guardarEncuesta({
        participante: codigo.trim(),
        fecha: new Date().toISOString(),
        respuestas: respuestas as number[],
        puntuacion,
      }),
    );
    setRespuestas(vacias());
    avisar({
      tono: 'bien',
      titulo: `Encuesta de ${codigo.trim()} guardada (${formatoNumero(puntuacion, 1)} puntos)`,
    });
  };

  return (
    <Pantalla
      titulo="Encuesta de usabilidad (SUS)"
      descripcion="Para terminar las pruebas con un voluntario. Marca de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo)."
      ancho="lectura"
      acciones={
        guardadas.length > 0 && (
          <BotonGrande
            icono="descargar"
            onClick={() =>
              descargar(
                `encuestas-sus-${new Date().toISOString().slice(0, 10)}.csv`,
                encuestasCsv(guardadas),
              )
            }
          >
            Exportar {guardadas.length} {guardadas.length === 1 ? 'encuesta' : 'encuestas'}
          </BotonGrande>
        )
      }
    >
      <CampoTexto
        etiqueta="Participante"
        valor={codigo}
        onCambio={setParticipante}
        ayuda="Código anónimo, como P01. Por defecto, el perfil activo."
        maxLength={60}
      />

      <ol className={estilos.preguntas}>
        {PREGUNTAS_SUS.map((pregunta, i) => (
          <li key={pregunta}>
            <fieldset className={estilos.pregunta}>
              <legend>
                <span className={estilos.numero}>{i + 1}.</span> {pregunta}
              </legend>
              <div className={estilos.escala}>
                {ESCALA.map(([valor, texto]) => (
                  <label key={valor} className={estilos.opcion}>
                    <input
                      type="radio"
                      name={`sus-${i}`}
                      value={valor}
                      checked={respuestas[i] === valor}
                      onChange={() => setRespuestas((r) => r.map((v, j) => (j === i ? valor : v)))}
                    />
                    <span className={estilos.valor}>{valor}</span>
                    <span className="solo-lectores">{texto}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {puntuacion === null ? (
        <p className={estilos.nota} role="status">
          Faltan {faltan} {faltan === 1 ? 'respuesta' : 'respuestas'}.
        </p>
      ) : (
        <Tarjeta titulo="Puntuación" nivel={2}>
          <p className={estilos.puntuacion} role="status">
            <span className="numeros">{formatoNumero(puntuacion, 1)}</span> de 100
          </p>
          <p>{interpretarSUS(puntuacion)}</p>
          {!codigo.trim() && (
            <Aviso tono="aviso" titulo="Escribe el código del participante para guardarla" />
          )}
          <div>
            <BotonGrande
              variante="principal"
              icono="bien"
              disabled={!codigo.trim()}
              onClick={guardar}
            >
              Guardar encuesta
            </BotonGrande>
          </div>
        </Tarjeta>
      )}
    </Pantalla>
  );
}
