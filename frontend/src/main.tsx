import '@fontsource-variable/atkinson-hyperlegible-next';
import './estilos/tokens.css';
import './estilos/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { aplicarApariencia, leerApariencia } from './estado/apariencia';

aplicarApariencia(leerApariencia());

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento #raiz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
