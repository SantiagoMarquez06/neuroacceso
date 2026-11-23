import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ajustesPorDefecto } from '../../api/ajustesPorDefecto';
import { api } from '../../api/rest';
import { useApariencia } from '../../estado/apariencia';
import { reiniciarMotor, useMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';
import { asignar, revisar } from './validar';

beforeEach(() => {
  reiniciarMotor();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('revisar: configuraciones peligrosas', () => {
  test('los ajustes por defecto son válidos', () => {
    expect(revisar(ajustesPorDefecto())).toEqual({ errores: [], avisos: [] });
  });

  test('no se puede dejar sin gesto la pausa del cursor', () => {
    const a = asignar(ajustesPorDefecto(), 'cursor', 'winkL', 'ninguna');
    expect(revisar(a).errores).toEqual([expect.stringContaining('Pausar o reanudar')]);
  });

  test('no se puede dejar el comunicador sin gesto para seleccionar', () => {
    let a = asignar(ajustesPorDefecto(), 'comunicador', 'clench', 'ninguna');
    a = asignar(a, 'comunicador', 'winkR', 'atras');
    expect(revisar(a).errores).toEqual([expect.stringContaining('Seleccionar')]);
  });

  test('avisa si el gesto de rescate también tiene otra acción', () => {
    const a = ajustesPorDefecto();
    a.gestos.gesto_rescate = 'clench';
    expect(revisar(a).avisos).toHaveLength(2); // clic en cursor y seleccionar en comunicador
    expect(revisar(a).errores).toEqual([]);
  });

  test('una frase rápida vacía no es válida', () => {
    const a = ajustesPorDefecto();
    a.comunicador.frases.push('  ');
    expect(revisar(a).errores).toEqual([expect.stringContaining('frase rápida vacía')]);
  });

  test('asignar "ninguna" quita el gesto del mapeo', () => {
    const a = asignar(ajustesPorDefecto(), 'cursor', 'smile', 'doble_clic');
    expect(a.gestos.mapeo.cursor['smile']).toBe('doble_clic');
    expect(asignar(a, 'cursor', 'smile', 'ninguna').gestos.mapeo.cursor).not.toHaveProperty(
      'smile',
    );
  });
});

describe('pantalla de ajustes', () => {
  test('sin perfil activo pide elegir uno', () => {
    usarMotorFalso({ sembrado: false });
    renderizarApp('/ajustes');
    expect(screen.getByText('Elige un perfil primero')).toBeInTheDocument();
  });

  test('un cambio se guarda solo, completo, y el motor lo aplica al instante', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(
      await screen.findByRole('button', { name: 'Subir Sensibilidad horizontal' }),
    );

    await waitFor(() => expect(api.perfiles.guardarAjustes).toHaveBeenCalledOnce(), {
      timeout: 2000,
    });
    const [perfil, guardados] = vi.mocked(api.perfiles.guardarAjustes).mock.calls[0]!;
    expect(perfil).toBe('p-1');
    expect(guardados).toEqual({
      ...ajustesPorDefecto(),
      cursor: { ...ajustesPorDefecto().cursor, ganancia_x: 26 },
    });
    // El motor emite `ajustes` y el resto de la interfaz ya lo sabe.
    expect(useMotor.getState().ajustes?.cursor.ganancia_x).toBe(26);
    expect(screen.getByRole('status', { name: 'Estado del guardado' })).toHaveTextContent(
      'Cambios guardados',
    );
  });

  test('varios cambios seguidos se guardan una sola vez', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    const subir = await screen.findByRole('button', { name: 'Subir Sensibilidad vertical' });

    for (let i = 0; i < 4; i += 1) await usuario.click(subir);

    await waitFor(() => expect(api.perfiles.guardarAjustes).toHaveBeenCalledOnce(), {
      timeout: 2000,
    });
    expect(vi.mocked(api.perfiles.guardarAjustes).mock.calls[0]![1].cursor.ganancia_y).toBe(29);
  });

  test('una configuración peligrosa no se guarda y se explica por qué', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(await screen.findByRole('tab', { name: 'Gestos' }));

    await usuario.selectOptions(
      await screen.findByLabelText('Guiño izquierdo con el cursor'),
      'ninguna',
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Asigna un gesto a «Pausar o reanudar»');
    await new Promise((r) => setTimeout(r, 700));
    expect(api.perfiles.guardarAjustes).not.toHaveBeenCalled();

    // Al corregirlo, se guarda.
    await usuario.selectOptions(screen.getByLabelText('Parpadeo con el cursor'), 'pausar');
    await waitFor(() => expect(api.perfiles.guardarAjustes).toHaveBeenCalledOnce(), {
      timeout: 2000,
    });
  });

  test('el gesto de rescate no se puede asignar a otra acción', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(await screen.findByRole('tab', { name: 'Gestos' }));

    expect(await screen.findByLabelText('Cejas arriba con el cursor')).toBeDisabled();
    await usuario.selectOptions(screen.getByLabelText('Gesto de rescate'), 'frown');
    expect(screen.getByLabelText('Cejas arriba con el cursor')).toBeEnabled();
    expect(screen.getByLabelText('Ceño fruncido con el cursor')).toBeDisabled();
  });

  test('editor de frases rápidas: añadir, reordenar y borrar', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(await screen.findByRole('tab', { name: 'Comunicador' }));

    await usuario.type(screen.getByLabelText('Nueva frase'), 'Quiero ver a mi hija{Enter}');
    expect(screen.getByLabelText('Frase 7')).toHaveValue('Quiero ver a mi hija');

    await usuario.click(screen.getByRole('button', { name: 'Subir «Quiero ver a mi hija»' }));
    expect(screen.getByLabelText('Frase 6')).toHaveValue('Quiero ver a mi hija');

    await usuario.click(screen.getByRole('button', { name: 'Borrar «Sí»' }));
    expect(screen.getByLabelText('Frase 1')).toHaveValue('No');

    await waitFor(() => expect(api.perfiles.guardarAjustes).toHaveBeenCalled(), { timeout: 2000 });
    expect(vi.mocked(api.perfiles.guardarAjustes).mock.lastCall![1].comunicador.frases).toEqual([
      'No',
      'Tengo sed',
      'Tengo dolor',
      'Necesito ayuda',
      'Quiero ver a mi hija',
      'Gracias',
    ]);
  });

  test('restablecer pide confirmación y vuelve a los valores de fábrica', async () => {
    const motor = usarMotorFalso();
    const a = motor.obtenerAjustes('p-1');
    a.cursor.ganancia_x = 80;
    motor.guardarAjustes('p-1', a);
    const { usuario } = renderizarApp('/ajustes');
    expect(await screen.findByText('80')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Restablecer' }));
    await usuario.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Restablecer' }),
    );

    expect(screen.getAllByText('25')).not.toHaveLength(0);
    await waitFor(() => expect(motor.obtenerAjustes('p-1')).toEqual(ajustesPorDefecto()), {
      timeout: 2000,
    });
  });

  test('si se sale antes de guardar, se guarda igual', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(
      await screen.findByRole('button', { name: 'Subir Sensibilidad horizontal' }),
    );

    await usuario.click(screen.getByRole('link', { name: 'Inicio' }));

    expect(api.perfiles.guardarAjustes).toHaveBeenCalledOnce();
  });

  test('la apariencia cambia al momento y es local de la interfaz', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/ajustes');
    await usuario.click(await screen.findByRole('tab', { name: 'Apariencia' }));

    await usuario.selectOptions(screen.getByLabelText('Colores'), 'contraste');
    await usuario.selectOptions(screen.getByLabelText('Tamaño del texto'), 'grande');

    expect(document.documentElement.dataset['tema']).toBe('contraste');
    expect(document.documentElement.dataset['texto']).toBe('grande');
    expect(api.perfiles.guardarAjustes).not.toHaveBeenCalled();
    act(() => useApariencia.getState().cambiar({ tema: 'oscuro', texto: 'normal' }));
  });
});
