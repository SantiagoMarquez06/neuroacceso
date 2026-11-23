import { useState, type FormEvent } from 'react';
import { BotonGrande, CampoTexto, Dialogo } from '../../componentes';
import { textoDeError } from '../../estado/avisos';

const MAX_NOMBRE = 60; // límite del contrato

interface PropsDialogoNombre {
  abierto: boolean;
  titulo: string;
  /** Texto del botón que confirma ("Crear perfil", "Guardar nombre"). */
  accion: string;
  inicial?: string;
  onCerrar: () => void;
  /** Recibe el nombre ya limpio. Si lanza, el error se muestra en el diálogo. */
  onConfirmar: (nombre: string) => Promise<unknown>;
}

/** Pide un nombre de perfil (crear o renombrar). */
export function DialogoNombre(props: PropsDialogoNombre) {
  if (!props.abierto) return null;
  // Se monta de nuevo en cada apertura: arranca siempre con el nombre inicial y sin errores.
  return <Contenido {...props} />;
}

function Contenido({ titulo, accion, inicial = '', onCerrar, onConfirmar }: PropsDialogoNombre) {
  const [nombre, setNombre] = useState(inicial);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento?: FormEvent) => {
    evento?.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return setError('Escribe un nombre.');
    if (limpio.length > MAX_NOMBRE) return setError(`Usa como mucho ${MAX_NOMBRE} letras.`);
    setEnviando(true);
    try {
      await onConfirmar(limpio);
      onCerrar();
    } catch (e) {
      setError(textoDeError(e).titulo);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo
      abierto
      titulo={titulo}
      onCerrar={onCerrar}
      acciones={
        <>
          <BotonGrande onClick={onCerrar}>Cancelar</BotonGrande>
          <BotonGrande variante="principal" disabled={enviando} onClick={() => void enviar()}>
            {accion}
          </BotonGrande>
        </>
      }
    >
      <form onSubmit={enviar}>
        <CampoTexto
          etiqueta="Nombre"
          valor={nombre}
          onCambio={(v) => {
            setNombre(v);
            setError(undefined);
          }}
          error={error}
          ayuda="Para las pruebas con voluntarios usa un código anónimo, como P01."
          maxLength={MAX_NOMBRE}
          autoComplete="off"
        />
      </form>
    </Dialogo>
  );
}
