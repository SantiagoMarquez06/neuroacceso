import { act, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { api } from '../../api/rest';
import { reiniciarMotor } from '../../estado/motor';
import { usarMotorFalso } from '../../pruebas/motorDePrueba';
import { renderizarApp } from '../../pruebas/utilidades';

beforeEach(() => reiniciarMotor());

const perfilActivo = () => screen.getByRole('link', { name: /^Perfil activo/ });

describe('Inicio: elegir perfil', () => {
  test('muestra un perfil por tarjeta, con su última sesión, y marca el que está en uso', async () => {
    usarMotorFalso({ conHistorial: true });
    renderizarApp('/');

    const lista = await screen.findByRole('list', { name: 'Perfiles' });
    const ana = within(lista).getByRole('button', { name: /Ana/ });
    expect(ana).toHaveAttribute('aria-current', 'true');
    expect(ana).toHaveTextContent(/Última sesión hace/);
    expect(within(lista).getByRole('button', { name: /Pedro/ })).toHaveTextContent(
      'Sin sesiones todavía',
    );
  });

  test('con todo listo (calibrado y buen contacto) lleva al panel principal', async () => {
    usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/');

    await usuario.click(await screen.findByRole('button', { name: /Pedro/ }));

    expect(api.perfiles.activar).toHaveBeenCalledWith('p-2');
    await waitFor(() => expect(rutaActual()).toBe('/estado'));
    await waitFor(() => expect(perfilActivo()).toHaveAccessibleName('Perfil activo: Pedro'));
  });

  test('si falta calibrar o el contacto es malo, lleva al asistente de preparación', async () => {
    const motor = usarMotorFalso();
    const { usuario, rutaActual } = renderizarApp('/');
    act(() => motor.simularContacto(true)); // contacto 79 % < 80 %

    await usuario.click(await screen.findByRole('button', { name: /Ana/ }));

    await waitFor(() => expect(rutaActual()).toBe('/preparacion'));
  });

  test('sin perfiles solo ofrece crear el primero, y al crearlo lo activa', async () => {
    usarMotorFalso({ sembrado: false });
    const { usuario, rutaActual } = renderizarApp('/');
    expect(await screen.findByText(/Crea el primero para empezar/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Nuevo perfil' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'P01');
    await usuario.click(screen.getByRole('button', { name: 'Crear y empezar' }));

    expect(api.perfiles.crear).toHaveBeenCalledWith({ nombre: 'P01' });
    expect(api.perfiles.activar).toHaveBeenCalled();
    await waitFor(() => expect(rutaActual()).toBe('/preparacion')); // sin casco: a preparar
  });

  test('no deja crear un perfil sin nombre', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/');
    await usuario.click(await screen.findByRole('button', { name: 'Nuevo perfil' }));

    await usuario.type(screen.getByLabelText('Nombre'), '   {Enter}');

    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Escribe un nombre.');
    expect(api.perfiles.crear).not.toHaveBeenCalled();
  });
});

describe('Perfiles: gestión', () => {
  test('crear añade el perfil a la lista', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/perfiles');

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo perfil' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Lucía');
    await usuario.click(screen.getByRole('button', { name: 'Crear perfil' }));

    expect(await screen.findByRole('region', { name: 'Lucía' })).toBeInTheDocument();
  });

  test('renombrar el perfil en uso se refleja en la barra superior', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/perfiles');
    const ana = await screen.findByRole('region', { name: 'Ana' });

    await usuario.click(within(ana).getByRole('button', { name: 'Cambiar nombre' }));
    const campo = screen.getByLabelText('Nombre');
    expect(campo).toHaveValue('Ana');
    await usuario.clear(campo);
    await usuario.type(campo, 'Ana María');
    await usuario.click(screen.getByRole('button', { name: 'Guardar nombre' }));

    expect(api.perfiles.editar).toHaveBeenCalledWith('p-1', { nombre: 'Ana María' });
    await waitFor(() => expect(perfilActivo()).toHaveAccessibleName('Perfil activo: Ana María'));
  });

  test('activar otro perfil', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/perfiles');
    const pedro = await screen.findByRole('region', { name: 'Pedro' });

    await usuario.click(within(pedro).getByRole('button', { name: 'Usar este perfil' }));

    expect(api.perfiles.activar).toHaveBeenCalledWith('p-2');
    await waitFor(() => expect(perfilActivo()).toHaveAccessibleName('Perfil activo: Pedro'));
  });

  test('eliminar pide confirmación y avisa de que se borran sus sesiones', async () => {
    usarMotorFalso({ conHistorial: true });
    const { usuario } = renderizarApp('/perfiles');
    const ana = await screen.findByRole('region', { name: 'Ana' });
    await waitFor(() => expect(ana).toHaveTextContent('16 sesiones'));

    await usuario.click(within(ana).getByRole('button', { name: 'Eliminar' }));
    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar el perfil «Ana»?' });
    expect(dialogo).toHaveTextContent('sus 16 sesiones');
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus(); // lo seguro

    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar para siempre' }));

    expect(api.perfiles.eliminar).toHaveBeenCalledWith('p-1');
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Ana' })).not.toBeInTheDocument(),
    );
  });

  test('cancelar no elimina nada', async () => {
    usarMotorFalso();
    const { usuario } = renderizarApp('/perfiles');
    await usuario.click(
      within(await screen.findByRole('region', { name: 'Pedro' })).getByRole('button', {
        name: 'Eliminar',
      }),
    );

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(api.perfiles.eliminar).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Pedro' })).toBeInTheDocument();
  });

  test('si el motor no responde, lo dice y permite reintentar', async () => {
    usarMotorFalso();
    vi.spyOn(api.perfiles, 'listar').mockRejectedValueOnce(new TypeError('x'));
    renderizarApp('/perfiles');

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
