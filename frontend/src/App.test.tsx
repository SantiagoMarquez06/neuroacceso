import { screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { api } from './api/rest';
import { reiniciarMotor } from './estado/motor';
import { evento, usarMotorFalso } from './pruebas/motorDePrueba';
import { renderizarApp } from './pruebas/utilidades';
import { recibir } from './estado/conexion';
import { act } from 'react';

beforeEach(() => reiniciarMotor());

test('la aplicación arranca y muestra su nombre y el estado del sistema', () => {
  usarMotorFalso();
  renderizarApp('/estado');

  expect(screen.getByRole('link', { name: 'NeuroAcceso' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).toHaveTextContent('Casco conectado');
});

test('al reconectar (nuevo hola) vuelve a pedir los datos al motor', async () => {
  const motor = usarMotorFalso();
  renderizarApp('/estado');
  await waitFor(() => expect(api.perfiles.listar).toHaveBeenCalledTimes(1));

  motor.crearPerfil({ nombre: 'Lucía' }); // cambió algo mientras no había conexión
  act(() => recibir(evento('hola', motor.hola())));

  await waitFor(() => expect(api.perfiles.listar).toHaveBeenCalledTimes(2));
});
