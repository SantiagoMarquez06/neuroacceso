import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('la aplicación arranca y muestra su nombre', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'NeuroAcceso' })).toBeInTheDocument();
});
