import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ErrorApi } from '../api/rest';
import { SENSORES } from '../api/tipos';
import { orientacion, posicionPunto } from '../estado/orientacion';
import {
  Aviso,
  Bateria,
  BotonGrande,
  CampoTexto,
  Cargando,
  Deslizador,
  Dialogo,
  ErrorPantalla,
  IndicadorEstado,
  IndicadorOrientacion,
  Interruptor,
  ListaEventos,
  MapaSensores,
  Medidor,
  Pestanas,
  Resaltado,
  Selector,
  Tarjeta,
  Vacio,
} from '.';
import { zonasPorRevisar } from '../textos';

const BUENO = Object.fromEntries(SENSORES.map((s) => [s, 4]));

describe('BotonGrande', () => {
  test('es un botón con texto que responde al clic', async () => {
    const alPulsar = vi.fn();
    render(
      <BotonGrande icono="pausa" onClick={alPulsar}>
        Pausar
      </BotonGrande>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));

    expect(alPulsar).toHaveBeenCalledOnce();
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  test('deshabilitado no responde', async () => {
    const alPulsar = vi.fn();
    render(
      <BotonGrande disabled onClick={alPulsar}>
        Guardar
      </BotonGrande>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(alPulsar).not.toHaveBeenCalled();
  });

  test('se puede usar por barrido: marca si su grupo está resaltado o si es el elemento activo', () => {
    const { rerender } = render(<BotonGrande>A</BotonGrande>);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-barrido');

    rerender(<BotonGrande barrido="grupo">A</BotonGrande>);
    expect(screen.getByRole('button')).toHaveAttribute('data-barrido', 'grupo');

    rerender(<BotonGrande barrido="activo">A</BotonGrande>);
    expect(screen.getByRole('button')).toHaveAttribute('data-barrido', 'activo');
  });

  test('un botón de solo icono necesita y usa su nombre accesible', () => {
    render(<BotonGrande icono="cerrar" aria-label="Cerrar" />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});

describe('Resaltado', () => {
  test('agrupa elementos y refleja el nivel del barrido', () => {
    const { rerender } = render(
      <Resaltado etiqueta="Fila 1">
        <BotonGrande>A</BotonGrande>
      </Resaltado>,
    );
    const grupo = screen.getByRole('group', { name: 'Fila 1' });
    expect(grupo).not.toHaveAttribute('data-barrido');
    expect(within(grupo).getByRole('button', { name: 'A' })).toBeInTheDocument();

    rerender(
      <Resaltado etiqueta="Fila 1" nivel="grupo">
        <BotonGrande>A</BotonGrande>
      </Resaltado>,
    );
    expect(grupo).toHaveAttribute('data-barrido', 'grupo');
  });
});

describe('Tarjeta', () => {
  test('es una región con el nombre de su título', () => {
    render(
      <Tarjeta titulo="Último gesto" nivel={3}>
        <p>Guiño derecho</p>
      </Tarjeta>,
    );

    const region = screen.getByRole('region', { name: 'Último gesto' });
    expect(within(region).getByRole('heading', { level: 3 })).toHaveTextContent('Último gesto');
    expect(within(region).getByText('Guiño derecho')).toBeInTheDocument();
  });
});

describe('IndicadorEstado y Bateria', () => {
  test('el indicador muestra su texto y su tono', () => {
    render(<IndicadorEstado tono="bien">Casco conectado</IndicadorEstado>);
    expect(screen.getByText('Casco conectado').parentElement).toHaveAttribute('data-tono', 'bien');
  });

  test('la batería se anuncia con su porcentaje', () => {
    render(<Bateria porcentaje={82} />);
    expect(screen.getByRole('img', { name: 'Batería 82 %' })).toBeInTheDocument();
  });

  test('por debajo del 20 % avisa de que está baja', () => {
    render(<Bateria porcentaje={12} />);
    expect(screen.getByRole('img', { name: 'Batería 12 % (baja)' })).toBeInTheDocument();
  });

  test('sin datos no inventa un porcentaje', () => {
    render(<Bateria porcentaje={null} />);
    expect(screen.getByRole('img', { name: 'Batería: sin datos' })).toHaveTextContent('—');
  });
});

describe('Medidor', () => {
  test('expone el progreso como barra de progreso', () => {
    render(<Medidor valor={0.65} etiqueta="Calibración" />);

    const barra = screen.getByRole('progressbar', { name: 'Calibración' });
    expect(barra).toHaveAttribute('aria-valuenow', '65');
    expect(barra).toHaveTextContent('65 %');
  });

  test('acota los valores fuera de 0–1', () => {
    render(<Medidor valor={1.7} etiqueta="Progreso" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('MapaSensores', () => {
  test('dibuja los 14 sensores con su nivel de contacto', () => {
    const { container } = render(<MapaSensores contacto={{ ...BUENO, T7: 1, O1: 2, P7: 0 }} />);

    expect(container.querySelectorAll('[data-sensor]')).toHaveLength(14);
    const nivel = (s: string) =>
      container.querySelector(`[data-sensor="${s}"]`)?.getAttribute('data-nivel');
    expect(nivel('AF3')).toBe('bueno');
    expect(nivel('O1')).toBe('regular');
    expect(nivel('T7')).toBe('malo');
    expect(nivel('P7')).toBe('sin_senal');
  });

  test('ofrece el mismo contenido en texto para lectores de pantalla', () => {
    render(<MapaSensores contacto={{ ...BUENO, T7: 1 }} />);

    expect(screen.getByText('T7, sobre la oreja izquierda: Mal contacto')).toBeInTheDocument();
    expect(screen.getByText('AF4, frente derecha: Buen contacto')).toBeInTheDocument();
  });

  test('sin datos del casco, todos los sensores aparecen sin contacto', () => {
    const { container } = render(<MapaSensores contacto={null} />);
    expect(container.querySelectorAll('[data-nivel="sin_senal"]')).toHaveLength(14);
  });

  test('zonasPorRevisar describe en palabras dónde falla el contacto', () => {
    expect(zonasPorRevisar({ ...BUENO, T7: 1, O1: 0, F3: 2 })).toEqual([
      'sobre la oreja izquierda',
      'nuca izquierda',
    ]);
    expect(zonasPorRevisar(BUENO)).toEqual([]);
    expect(zonasPorRevisar(null)).toEqual([]);
  });
});

describe('IndicadorOrientacion', () => {
  test('sigue a la orientación sin pasar por el estado de React', () => {
    orientacion.fijar({ yaw: 0, pitch: 0, calibrado: true });
    render(<IndicadorOrientacion />);
    expect(screen.getByText('Giro 0° · Inclinación 0°')).toBeInTheDocument();

    act(() => orientacion.fijar({ yaw: 3.4, pitch: -12, calibrado: true }));

    expect(screen.getByText('Giro +3° · Inclinación −12°')).toBeInTheDocument();
  });

  test('el punto se mueve con la cabeza y no se sale del recuadro', () => {
    expect(posicionPunto({ yaw: 0, pitch: 0 })).toEqual({ x: 0, y: -0 });
    expect(posicionPunto({ yaw: 15, pitch: 15 })).toEqual({ x: 0.5, y: -0.5 }); // arriba = y negativa
    expect(posicionPunto({ yaw: -90, pitch: -90 })).toEqual({ x: -1, y: 1 });
  });
});

describe('ListaEventos', () => {
  test('lista las entradas con su hora, la más reciente primero', () => {
    render(
      <ListaEventos
        entradas={[
          { id: 2, t: 1_763_300_002_000, texto: 'Guiño derecho → Clic derecho', tono: 'bien' },
          { id: 1, t: 1_763_300_001_000, texto: 'Parpadeo (sin acción)', tono: 'neutro' },
        ]}
      />,
    );

    const filas = within(screen.getByRole('log')).getAllByRole('listitem');
    expect(filas.map((f) => f.querySelector('span')?.textContent)).toEqual([
      'Guiño derecho → Clic derecho',
      'Parpadeo (sin acción)',
    ]);
    expect(filas[0]?.querySelector('time')).toHaveAttribute('datetime');
  });

  test('vacía explica qué aparecerá', () => {
    render(<ListaEventos entradas={[]} />);
    expect(screen.getByText(/aparecerá cada gesto/)).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
});

describe('Deslizador', () => {
  function Ejemplo({ inicial = 1200 }: { inicial?: number }) {
    const [valor, setValor] = useState(inicial);
    return (
      <Deslizador
        etiqueta="Velocidad de barrido"
        valor={valor}
        min={300}
        max={5000}
        paso={100}
        onCambio={setValor}
        formato={(v) => `${v} ms`}
        ayuda="Tiempo que se resalta cada opción."
      />
    );
  }

  test('los botones − y + cambian el valor de paso en paso', async () => {
    render(<Ejemplo />);
    expect(screen.getByText('1200 ms')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Subir Velocidad de barrido' }));
    await userEvent.click(screen.getByRole('button', { name: 'Subir Velocidad de barrido' }));
    expect(screen.getByText('1400 ms')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bajar Velocidad de barrido' }));
    expect(screen.getByText('1300 ms')).toBeInTheDocument();
  });

  test('no pasa de sus límites', () => {
    render(<Ejemplo inicial={5000} />);
    expect(screen.getByRole('button', { name: 'Subir Velocidad de barrido' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar Velocidad de barrido' })).toBeEnabled();
  });

  test('la barra tiene etiqueta, valor legible y descripción', () => {
    render(<Ejemplo />);
    const barra = screen.getByRole('slider', { name: 'Velocidad de barrido' });
    expect(barra).toHaveAttribute('aria-valuetext', '1200 ms');
    expect(barra).toHaveAccessibleDescription('Tiempo que se resalta cada opción.');
  });

  test('con pasos decimales no acumula errores de redondeo', async () => {
    const alCambiar = vi.fn();
    render(
      <Deslizador
        etiqueta="Zona muerta"
        valor={0.2}
        min={0}
        max={5}
        paso={0.1}
        onCambio={alCambiar}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Subir Zona muerta' }));

    expect(alCambiar).toHaveBeenCalledWith(0.3); // y no 0.30000000000000004
  });
});

describe('Interruptor, Selector y CampoTexto', () => {
  test('el interruptor alterna y expone su estado', async () => {
    const alCambiar = vi.fn();
    render(<Interruptor etiqueta="Invertir horizontal" activo={false} onCambio={alCambiar} />);

    const control = screen.getByRole('switch', { name: /Invertir horizontal/ });
    expect(control).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(control);

    expect(alCambiar).toHaveBeenCalledWith(true);
  });

  test('el selector avisa del valor elegido', async () => {
    const alCambiar = vi.fn();
    render(
      <Selector
        etiqueta="Disposición del teclado"
        valor="abc"
        opciones={[
          { valor: 'abc', texto: 'Alfabético' },
          { valor: 'frecuencia', texto: 'Letras más usadas primero' },
        ]}
        onCambio={alCambiar}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Disposición del teclado'), 'frecuencia');

    expect(alCambiar).toHaveBeenCalledWith('frecuencia');
  });

  test('el campo de texto muestra su error y lo asocia al campo', async () => {
    const alCambiar = vi.fn();
    render(
      <CampoTexto etiqueta="Nombre" valor="" onCambio={alCambiar} error="Escribe un nombre" />,
    );

    const campo = screen.getByLabelText('Nombre');
    expect(campo).toBeInvalid();
    expect(campo).toHaveAccessibleDescription('Escribe un nombre');
    await userEvent.type(campo, 'A');
    expect(alCambiar).toHaveBeenCalledWith('A');
  });
});

describe('Pestanas', () => {
  function Ejemplo() {
    const [activa, setActiva] = useState<'cursor' | 'gestos' | 'voz'>('cursor');
    return (
      <Pestanas
        etiqueta="Secciones de ajustes"
        activa={activa}
        onCambio={setActiva}
        pestanas={[
          { valor: 'cursor', texto: 'Cursor' },
          { valor: 'gestos', texto: 'Gestos' },
          { valor: 'voz', texto: 'Voz' },
        ]}
      >
        <p>Contenido de {activa}</p>
      </Pestanas>
    );
  }

  test('muestra el panel de la pestaña elegida', async () => {
    render(<Ejemplo />);
    expect(screen.getByRole('tab', { name: 'Cursor' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Gestos' }));

    expect(screen.getByRole('tabpanel', { name: 'Gestos' })).toHaveTextContent(
      'Contenido de gestos',
    );
  });

  test('se recorre con las flechas del teclado', async () => {
    render(<Ejemplo />);
    screen.getByRole('tab', { name: 'Cursor' }).focus();

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Voz' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Voz' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Cursor' })).toHaveFocus();

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Voz' })).toHaveFocus();
  });
});

describe('Aviso y estados de pantalla', () => {
  test('un aviso de error se anuncia como alerta; los demás, como estado', () => {
    const { rerender } = render(<Aviso tono="mal" titulo="El casco se desconectó" />);
    expect(screen.getByRole('alert')).toHaveTextContent('El casco se desconectó');

    rerender(
      <Aviso tono="aviso" titulo="Batería baja">
        Conecta el cargador.
      </Aviso>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Batería baja');
    expect(screen.getByRole('status')).toHaveTextContent('Conecta el cargador.');
  });

  test('cargando nunca deja la pantalla en blanco', () => {
    render(<Cargando texto="Cargando perfiles…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando perfiles…');
  });

  test('vacío explica y ofrece crear lo primero', () => {
    render(
      <Vacio titulo="Todavía no hay perfiles" accion={<BotonGrande>Crear perfil</BotonGrande>}>
        Cada persona tiene su propio perfil.
      </Vacio>,
    );
    expect(screen.getByText('Todavía no hay perfiles')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear perfil' })).toBeInTheDocument();
  });

  test('el error se muestra en lenguaje claro, sin códigos, y permite reintentar', async () => {
    const reintentar = vi.fn();
    render(
      <ErrorPantalla
        error={
          new ErrorApi(502, 'CORTEX_NO_DISPONIBLE', 'ConnectionRefusedError: [WinError 10061]')
        }
        onReintentar={reintentar}
      />,
    );

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se encuentra el programa de Emotiv');
    expect(alerta).toHaveTextContent('Abre el EMOTIV Launcher');
    expect(alerta).not.toHaveTextContent(/CORTEX|WinError|502/);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalledOnce();
  });

  test('un error que no viene del motor también tiene mensaje claro', () => {
    render(
      <ErrorPantalla error={new TypeError("Cannot read properties of undefined (reading 'x')")} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('alert')).not.toHaveTextContent('undefined');
  });
});

describe('Dialogo', () => {
  function Ejemplo({ alCerrar = () => undefined }: { alCerrar?: () => void }) {
    const [abierto, setAbierto] = useState(false);
    const [nombre, setNombre] = useState('');
    const cerrar = () => {
      setAbierto(false);
      alCerrar();
    };
    return (
      <>
        <BotonGrande onClick={() => setAbierto(true)}>Nuevo perfil</BotonGrande>
        <Dialogo
          abierto={abierto}
          titulo="Nuevo perfil"
          onCerrar={cerrar}
          acciones={
            <>
              <BotonGrande onClick={cerrar}>Cancelar</BotonGrande>
              <BotonGrande variante="principal">Crear</BotonGrande>
            </>
          }
        >
          <CampoTexto etiqueta="Nombre" valor={nombre} onCambio={setNombre} />
        </Dialogo>
      </>
    );
  }

  test('cerrado no está en la página', () => {
    render(<Ejemplo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('al abrir lleva el foco al primer campo', async () => {
    render(<Ejemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo perfil' }));

    expect(screen.getByRole('dialog', { name: 'Nuevo perfil' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  test('Tab no se escapa del diálogo', async () => {
    render(<Ejemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Nuevo perfil' }));

    await userEvent.tab(); // Nombre → Cancelar
    await userEvent.tab(); // → Crear
    expect(screen.getByRole('button', { name: 'Crear' })).toHaveFocus();
    await userEvent.tab(); // da la vuelta
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Crear' })).toHaveFocus();
  });

  test('Escape lo cierra y devuelve el foco a quien lo abrió', async () => {
    const alCerrar = vi.fn();
    render(<Ejemplo alCerrar={alCerrar} />);
    const abrir = screen.getByRole('button', { name: 'Nuevo perfil' });
    await userEvent.click(abrir);

    await userEvent.keyboard('{Escape}');

    expect(alCerrar).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });
});
