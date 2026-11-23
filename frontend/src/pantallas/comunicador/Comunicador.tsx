// Comunicador (docs/pantallas.md §4.4): escribir y hablar solo con gestos.
//
// - Al entrar pide al motor el modo `comunicador` (el ratón queda quieto y los gestos llegan como
//   eventos `entrada`); al salir, vuelve a `cursor`.
// - Barrido por grupos: frases rápidas · predicción · filas del teclado · controles.
// - Cada texto dicho con HABLAR se registra como enunciado de una sesión `comunicador`
//   (caracteres/min). La sesión se crea con el primer enunciado: entrar y salir sin decir nada
//   no deja sesiones vacías en el historial.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/rest';
import { AJUSTES_POR_DEFECTO } from '../../api/ajustesPorDefecto';
import { useBarrido } from '../../barrido/useBarrido';
import { Aviso, BotonGrande, Resaltado } from '../../componentes';
import { avisarError } from '../../estado/avisos';
import { useEvento } from '../../estado/conexion';
import { useMotor } from '../../estado/motor';
import { pedirModo } from '../../estado/ordenes';
import {
  aprender,
  completar,
  guardarHistorial,
  leerHistorial,
  sugerir,
  type Historial,
} from '../../prediccion/prediccion';
import { AYUDA_INSTALAR_VOZ, decir, elegirVoz, useVoces } from '../../voz/voz';
import estilos from './Comunicador.module.css';
import { CONTROLES, filasTeclado, gruposDeBarrido, type Control } from './teclado';

const MAX_TEXTO = 2000; // límite del contrato para un enunciado

/** Medidas de lo que se escribió desde la última vez que se habló. */
interface Medida {
  desde: number | null;
  selecciones: number;
  correcciones: number;
}
const MEDIDA_NUEVA: Medida = { desde: null, selecciones: 0, correcciones: 0 };

export function Comunicador() {
  const navegar = useNavigate();
  const ajustes = useMotor((s) => s.ajustes) ?? AJUSTES_POR_DEFECTO;
  const modo = useMotor((s) => s.estado?.modo ?? 'desconectado');
  const perfilId = useMotor((s) => s.estado?.perfil_activo_id ?? null);
  const voces = useVoces();
  const hayVozLocal = elegirVoz(voces, ajustes.voz.voz_id) !== null;

  const [texto, setTexto] = useState('');
  // Palabras aprendidas, del perfil activo (si cambia el perfil, se leen las del nuevo).
  const [aprendido, setAprendido] = useState<{ perfil: string | null; historial: Historial }>({
    perfil: null,
    historial: {},
  });
  const historial = useMemo(
    () => (aprendido.perfil === perfilId ? aprendido.historial : leerHistorial(perfilId)),
    [aprendido, perfilId],
  );
  const medida = useRef<Medida>(MEDIDA_NUEVA);
  const sesion = useRef<string | null>(null);

  // ---- Entrar y salir: el motor pasa a comunicador y vuelve a cursor ---------------------------
  useEffect(() => {
    pedirModo('comunicador').catch(() => undefined); // si no hay casco, se avisa abajo
    return () => {
      pedirModo('cursor').catch(() => undefined);
      const id = sesion.current;
      sesion.current = null;
      if (id) api.sesiones.finalizar(id).catch(() => undefined);
    };
  }, []);

  // ---- Contenido de los grupos ----------------------------------------------------------------
  const filas = useMemo(
    () => filasTeclado(ajustes.comunicador.disposicion),
    [ajustes.comunicador.disposicion],
  );
  const frases = ajustes.comunicador.frases;
  const sugerencias = useMemo(() => sugerir(texto, historial), [texto, historial]);
  const grupos = useMemo(() => gruposDeBarrido(filas.length), [filas.length]);
  const tamanos = grupos.map((g) =>
    g.tipo === 'frases'
      ? frases.length
      : g.tipo === 'prediccion'
        ? sugerencias.length
        : g.tipo === 'fila'
          ? (filas[g.fila]?.length ?? 0)
          : CONTROLES.length,
  );

  // ---- Acciones -------------------------------------------------------------------------------
  const editar = useCallback((cambio: (previo: string) => string, correccion = false) => {
    medida.current = {
      desde: medida.current.desde ?? performance.now(),
      selecciones: medida.current.selecciones + 1,
      correcciones: medida.current.correcciones + (correccion ? 1 : 0),
    };
    setTexto((previo) => cambio(previo).slice(0, MAX_TEXTO));
  }, []);

  const hablar = useCallback(
    async (dicho: string, registrar: boolean) => {
      if (!dicho.trim()) return;
      try {
        await decir(dicho, { vozId: ajustes.voz.voz_id, velocidad: ajustes.voz.velocidad });
      } catch (error) {
        avisarError(error);
        return;
      }
      if (!registrar) return;
      const nuevo = aprender(historial, dicho);
      setAprendido({ perfil: perfilId, historial: nuevo });
      guardarHistorial(perfilId, nuevo);
      const { desde, selecciones, correcciones } = medida.current;
      medida.current = MEDIDA_NUEVA;
      try {
        sesion.current ??= (await api.sesiones.crear('comunicador')).id;
        await api.sesiones.agregarEnunciado(sesion.current, {
          texto: dicho.trim(),
          duracion_ms: Math.round(desde === null ? 0 : performance.now() - desde),
          selecciones: selecciones + 1, // + la de HABLAR
          correcciones,
        });
      } catch {
        // Si no se pudo registrar (p. ej. sin perfil activo), la persona igual fue escuchada.
      }
    },
    [ajustes.voz.voz_id, ajustes.voz.velocidad, historial, perfilId],
  );

  const controlar = useCallback(
    (control: Control) => {
      switch (control) {
        case 'espacio':
          editar((t) => (t === '' || t.endsWith(' ') ? t : t + ' '));
          break;
        case 'borrar':
          editar((t) => t.slice(0, -1), true);
          break;
        case 'limpiar':
          medida.current = MEDIDA_NUEVA;
          setTexto('');
          break;
        case 'hablar':
          void hablar(texto, true);
          break;
        case 'salir':
          navegar('/estado');
          break;
      }
    },
    [editar, hablar, navegar, texto],
  );

  const activar = useCallback(
    (grupo: number, elemento: number) => {
      const g = grupos[grupo];
      if (!g) return;
      if (g.tipo === 'frases') {
        const frase = frases[elemento];
        // Una frase rápida se dice al momento; no cuenta para la velocidad de escritura.
        if (frase) void hablar(frase, false);
      } else if (g.tipo === 'prediccion') {
        const palabra = sugerencias[elemento];
        if (palabra) editar((t) => completar(t, palabra));
      } else if (g.tipo === 'fila') {
        const letra = filas[g.fila]?.[elemento];
        if (letra) editar((t) => t + letra);
      } else {
        const control = CONTROLES[elemento]?.control;
        if (control) controlar(control);
      }
    },
    [grupos, frases, sugerencias, filas, editar, hablar, controlar],
  );

  // ---- Barrido --------------------------------------------------------------------------------
  const barridoActivo = modo === 'comunicador';
  const barrido = useBarrido(tamanos, {
    tiempoMs: ajustes.comunicador.tiempo_barrido_ms,
    activo: barridoActivo,
    alActivar: ({ grupo, elemento }) => activar(grupo, elemento),
  });

  useEvento('entrada', ({ accion }) => {
    if (accion === 'seleccionar') barrido.seleccionar();
    else barrido.atras();
  });

  // Teclado del acompañante o en desarrollo: Espacio = seleccionar, Escape = atrás.
  const { seleccionar, atras } = barrido;
  useEffect(() => {
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.target instanceof HTMLInputElement || evento.repeat) return;
      if (evento.key === ' ') {
        evento.preventDefault();
        seleccionar();
      } else if (evento.key === 'Escape') {
        atras();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [seleccionar, atras]);

  const indice = (tipo: string, fila?: number) =>
    grupos.findIndex(
      (g) => g.tipo === tipo && (fila === undefined || ('fila' in g && g.fila === fila)),
    );

  // ---- Pantalla -------------------------------------------------------------------------------
  return (
    <div className={estilos.comunicador}>
      <h1 className="solo-lectores">Comunicador</h1>

      <AvisoBarrido modo={modo} />
      {voces.length > 0 && !hayVozLocal && (
        <Aviso tono="aviso" titulo="No hay una voz en español instalada en este equipo">
          {AYUDA_INSTALAR_VOZ}
        </Aviso>
      )}

      <output className={estilos.texto} aria-label="Texto escrito" aria-live="polite">
        {texto}
        <span className={estilos.cursorTexto} aria-hidden="true" />
      </output>

      <Resaltado
        etiqueta="Frases rápidas"
        nivel={barrido.resaltadoGrupo(indice('frases'))}
        className={estilos.fila}
      >
        {frases.map((frase, i) => (
          <BotonGrande
            key={`${frase}-${i}`}
            icono="voz"
            barrido={barrido.resaltado(indice('frases'), i)}
            onClick={() => activar(indice('frases'), i)}
          >
            {frase}
          </BotonGrande>
        ))}
      </Resaltado>

      <Resaltado
        etiqueta="Palabras sugeridas"
        nivel={barrido.resaltadoGrupo(indice('prediccion'))}
        className={`${estilos.fila} ${estilos.prediccion}`}
      >
        {sugerencias.length === 0 ? (
          <p className={estilos.sinSugerencias}>Sin sugerencias</p>
        ) : (
          sugerencias.map((palabra, i) => (
            <BotonGrande
              key={palabra}
              barrido={barrido.resaltado(indice('prediccion'), i)}
              onClick={() => activar(indice('prediccion'), i)}
            >
              {palabra}
            </BotonGrande>
          ))
        )}
      </Resaltado>

      <div className={estilos.teclado}>
        {filas.map((fila, f) => (
          <Resaltado
            key={fila.join('')}
            etiqueta={`Fila ${f + 1} del teclado`}
            nivel={barrido.resaltadoGrupo(indice('fila', f))}
            className={estilos.filaTeclas}
          >
            {fila.map((letra, i) => (
              <BotonGrande
                key={letra}
                tamano="grande"
                className={estilos.tecla}
                barrido={barrido.resaltado(indice('fila', f), i)}
                onClick={() => activar(indice('fila', f), i)}
              >
                {letra}
              </BotonGrande>
            ))}
          </Resaltado>
        ))}
      </div>

      <Resaltado
        etiqueta="Controles"
        nivel={barrido.resaltadoGrupo(indice('controles'))}
        className={estilos.controles}
      >
        {CONTROLES.map(({ control, texto: rotulo }, i) => (
          <BotonGrande
            key={control}
            tamano="grande"
            variante={control === 'hablar' ? 'principal' : 'secundario'}
            icono={ICONOS[control]}
            barrido={barrido.resaltado(indice('controles'), i)}
            onClick={() => activar(indice('controles'), i)}
          >
            {rotulo}
          </BotonGrande>
        ))}
      </Resaltado>
    </div>
  );
}

const ICONOS = {
  espacio: undefined,
  borrar: 'volver',
  hablar: 'voz',
  limpiar: 'borrar',
  salir: 'inicio',
} as const;

/** Explica por qué el barrido está quieto y cómo ponerlo en marcha. */
function AvisoBarrido({ modo }: { modo: string }) {
  if (modo === 'comunicador') return null;
  if (modo === 'desconectado') {
    return (
      <Aviso tono="aviso" titulo="Sin casco, el barrido está detenido">
        Puedes escribir pulsando las teclas con el ratón. Conecta el casco para usarlo con gestos.
      </Aviso>
    );
  }
  if (modo === 'calibrando' || modo === 'entrenando') {
    return <Aviso tono="aviso" titulo="El barrido empezará al terminar la calibración" />;
  }
  return (
    <Aviso
      tono="aviso"
      titulo="El barrido está detenido"
      acciones={
        <BotonGrande
          variante="principal"
          icono="reanudar"
          onClick={() => pedirModo('comunicador').catch(avisarError)}
        >
          Activar el barrido
        </BotonGrande>
      }
    >
      Los gestos están moviendo el cursor en lugar de elegir letras.
    </Aviso>
  );
}
