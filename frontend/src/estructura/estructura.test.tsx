import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, ErrorApi } from '../api/rest';
import { avisarError, useAvisos } from '../estado/avisos';
import { clienteEventos } from '../estado/conexion';
import { fijarEnlace, reiniciarMotor } from '../estado/motor';
import { llega, usarMotorFalso } from '../pruebas/motorDePrueba';
import { renderizarApp } from '../pruebas/utilidades';

beforeEach(() => {
  reiniciarMotor();
  useAvisos.setState({ avisos: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

const estados = () => screen.getByRole('list', { name: 'Estado del sistema' });

describe('barra superior: el estado siempre visible', () => {
  test('muestra conexión, contacto, modo, batería y perfil activo', async () => {
    usarMotorFalso();
    renderizarApp('/estado');

    expect(within(estados()).getByText('Casco conectado')).toBeInTheDocument();
    expect(within(estados()).getByText('Contacto 100 %')).toBeInTheDocument();
    expect(within(estados()).getByText('Cursor activo')).toBeInTheDocument();
    expect(within(estados()).getByRole('img', { name: 'Batería 82 %' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Perfil activo: Ana' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  test('se actualiza en vivo con los eventos del motor', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => void motor.cambiarModo('pausa'));
    expect(within(estados()).getByText('En pausa')).toBeInTheDocument();

    act(() => motor.simularContacto(true));
    expect(within(estados()).getByText('Contacto 79 %')).toBeInTheDocument();
  });

  test('sin casco no muestra batería ni contacto', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => motor.fallarConexion('SIN_CASCO', 'No se encontró ningún casco'));

    expect(within(estados()).getByText('Sin casco')).toBeInTheDocument();
    expect(within(estados()).queryByRole('img', { name: /Batería/ })).not.toBeInTheDocument();
    expect(within(estados()).queryByText(/Contacto/)).not.toBeInTheDocument();
  });

  test('el indicador del casco lleva a la pantalla de estado', async () => {
    usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/ajustes');

    await usuario.click(within(estados()).getByRole('link', { name: 'Casco conectado' }));

    expect(rutaActual()).toBe('/estado');
  });

  test('sin perfil activo invita a elegir uno', async () => {
    usarMotorFalso({ sembrado: false });
    renderizarApp('/estado');

    expect(
      await screen.findByRole('link', { name: 'Perfil activo: Elegir perfil' }),
    ).toBeInTheDocument();
  });
});

describe('navegación', () => {
  test('el menú lleva a cada pantalla y marca la actual', async () => {
    usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/estado');
    const menu = screen.getByRole('navigation', { name: 'Pantallas' });

    expect(within(menu).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const [nombre, ruta] of [
      ['Práctica', '/practica'],
      ['Entrenar', '/entrenamiento'],
      ['Ajustes', '/ajustes'],
      ['Historial', '/historial'],
    ] as const) {
      await usuario.click(within(menu).getByRole('link', { name: nombre }));
      expect(rutaActual()).toBe(ruta);
      expect(within(menu).getByRole('link', { name: nombre })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('el panel de pruebas solo aparece con el motor en modo demo', async () => {
    usarMotorFalso();
    renderizarApp('/estado');
    expect(await screen.findByRole('link', { name: 'Pruebas' })).toBeInTheDocument();
  });

  test('con el casco real no hay panel de pruebas', async () => {
    usarMotorFalso();
    const salud = vi
      .spyOn(api, 'salud')
      .mockResolvedValue({ version: '1.0.0', api_version: 1, fuente: 'cortex', demo: false });
    renderizarApp('/estado');

    await waitFor(() => expect(salud).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Pruebas' })).not.toBeInTheDocument();
  });

  test('en el comunicador el menú se oculta para ganar espacio', () => {
    usarMotorFalso();
    renderizarApp('/comunicador');
    expect(screen.queryByRole('navigation', { name: 'Pantallas' })).not.toBeInTheDocument();
  });

  test('una dirección desconocida ofrece volver al inicio', () => {
    usarMotorFalso();
    renderizarApp('/no-existe');
    expect(screen.getByRole('heading', { name: 'Esa pantalla no existe' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute(
      'href',
      '/estado',
    );
  });

  test('hay un enlace para saltar directo al contenido', () => {
    usarMotorFalso();
    renderizarApp('/estado');
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido');
  });

  test('cada pantalla pone su nombre en el título de la ventana', () => {
    usarMotorFalso();
    renderizarApp('/ajustes');
    expect(document.title).toBe('Ajustes · NeuroAcceso');
  });
});

describe('el modo lo decide el motor', () => {
  test('si el motor pasa a comunicador (gesto de rescate o barra flotante), se abre el comunicador', () => {
    const motor = usarMotorFalso();
    const { rutaActual } = renderizarApp('/estado');

    act(() => motor.simularGesto('surprise')); // gesto de rescate por defecto

    expect(rutaActual()).toBe('/comunicador');
  });

  test('si el gesto de rescate saca del comunicador, vuelve al panel principal', () => {
    const motor = usarMotorFalso();
    motor.cambiarModo('comunicador');
    const { rutaActual } = renderizarApp('/comunicador');

    act(() => motor.simularGesto('surprise'));

    expect(rutaActual()).toBe('/estado');
  });

  test('una pausa no cambia de pantalla', () => {
    const motor = usarMotorFalso();
    const { rutaActual } = renderizarApp('/ajustes');

    act(() => void motor.cambiarModo('pausa'));

    expect(rutaActual()).toBe('/ajustes');
  });
});

describe('franja de retroalimentación', () => {
  const franja = () => screen.getByRole('status', { name: 'Último gesto' });

  test('muestra cada gesto reconocido y lo que hizo, y se borra a los pocos segundos', () => {
    vi.useFakeTimers();
    const motor = usarMotorFalso();
    renderizarApp('/estado');
    expect(franja()).toHaveTextContent('Aquí verás cada gesto');

    act(() => motor.simularGesto('clench'));
    expect(franja()).toHaveTextContent('Apretar la mandíbula → Clic');

    act(() => void vi.advanceTimersByTime(3000));
    expect(franja()).toHaveTextContent('Aquí verás cada gesto');
  });

  test('un gesto sin acción asignada también se ve', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    act(() => motor.simularGesto('blink'));

    expect(franja()).toHaveTextContent('Parpadeo');
  });

  test('si la acción no se ejecutó, dice por qué en lenguaje claro', () => {
    usarMotorFalso();
    renderizarApp('/estado');

    llega('accion', {
      accion: 'clic',
      origen: { tipo: 'gesto', nombre: 'clench' },
      modo: 'pausa',
      ejecutada: false,
      motivo: 'pausado',
    });

    expect(franja()).toHaveTextContent('no se hizo «Clic» porque el cursor está en pausa');
  });
});

describe('estados globales', () => {
  test('mientras conecta muestra que está cargando, nunca una pantalla en blanco', () => {
    fijarEnlace({ estado: 'conectando', intentos: 0, esperaMs: null });
    renderizarApp('/estado');

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
      'Conectando con NeuroAcceso…',
    );
    expect(within(estados()).getByText('Sin conexión con NeuroAcceso')).toBeInTheDocument();
  });

  test('si el motor no responde lo dice y permite reintentar', async () => {
    fijarEnlace({ estado: 'reconectando', intentos: 3, esperaMs: 4000 });
    const reintentar = vi
      .spyOn(clienteEventos, 'reintentarAhora')
      .mockImplementation(() => undefined);
    const { usuario } = renderizarApp('/estado');

    expect(screen.getByText('No se puede conectar con NeuroAcceso')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar ahora' }));

    expect(reintentar).toHaveBeenCalledOnce();
  });

  test('si se pierde la conexión después de cargar, la pantalla sigue visible con un aviso', () => {
    usarMotorFalso();
    renderizarApp('/ajustes');

    act(() => fijarEnlace({ estado: 'reconectando', intentos: 1, esperaMs: 500 }));

    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se puede conectar con NeuroAcceso');
  });

  test('con un token no válido explica qué hacer y no reintenta', () => {
    fijarEnlace({ estado: 'no_autorizado', intentos: 0, esperaMs: null });
    renderizarApp('/estado');

    expect(screen.getByText('Esta ventana perdió el permiso')).toBeInTheDocument();
    expect(screen.getByText(/abre NeuroAcceso de nuevo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  test('si el casco falla dice qué hacer según el código, y Reintentar pide reconectar', async () => {
    const motor = usarMotorFalso();
    const { usuario } = renderizarApp('/estado');

    act(() => motor.fallarConexion('CORTEX_NO_DISPONIBLE', 'ConnectionRefusedError'));

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('No se encuentra el programa de Emotiv');
    expect(alerta).toHaveTextContent('Abre el EMOTIV Launcher');
    expect(alerta).not.toHaveTextContent('ConnectionRefusedError');

    await usuario.click(within(alerta).getByRole('button', { name: 'Reintentar' }));
    expect(api.conectar).toHaveBeenCalledOnce();
  });

  test('avisa de batería baja', () => {
    const motor = usarMotorFalso();
    renderizarApp('/estado');

    motor.bateria = 12;
    act(() => motor.simularContacto(false));

    expect(screen.getByText('Queda poca batería en el casco (12 %)')).toBeInTheDocument();
  });

  test('avisa de mal contacto diciendo dónde, sin nombres técnicos', () => {
    usarMotorFalso();
    renderizarApp('/ajustes');

    llega('dispositivo', {
      bateria_pct: 80,
      senal: 0.5,
      contacto: {
        AF3: 4,
        AF4: 4,
        F7: 1,
        F3: 1,
        FC5: 1,
        T7: 0,
        P7: 0,
        O1: 1,
        O2: 1,
        P8: 4,
        T8: 4,
        FC6: 4,
        F4: 4,
        F8: 4,
      },
      calidad_global: 45,
    });

    const aviso = screen.getByText('El casco no hace buen contacto').closest('[role="status"]');
    expect(aviso).toHaveTextContent('sobre la oreja izquierda');
    expect(aviso).not.toHaveTextContent('T7');
    expect(
      within(aviso as HTMLElement).getByRole('link', { name: 'Ver los sensores' }),
    ).toHaveAttribute('href', '/estado');
  });
});

describe('avisos breves', () => {
  test('un error de una orden se muestra traducido y se puede cerrar', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/estado');

    act(() =>
      avisarError(new ErrorApi(409, 'MODO_INVALIDO', 'No se puede pasar de calibrando a pausa')),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Ahora no se puede hacer eso');
    expect(screen.getByRole('alert')).not.toHaveTextContent('calibrando a pausa');

    await usuario.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('se cierra solo pasados unos segundos', () => {
    vi.useFakeTimers();
    usarMotorFalso();
    renderizarApp('/estado');

    act(() => avisarError(new Error('boom')));
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal');

    act(() => void vi.advanceTimersByTime(7000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
