import '@fontsource-variable/atkinson-hyperlegible-next';
import './estilos/tokens.css';
import './estilos/base.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { obtenerToken } from './api/config';
import { crearClienteConsultas } from './api/consultas';
import { App } from './App';
import { aplicarApariencia, leerApariencia } from './estado/apariencia';
import { iniciarConexion } from './estado/conexion';
import { rutas } from './rutas';

async function arrancar(): Promise<void> {
  aplicarApariencia(leerApariencia());
  obtenerToken(); // lo toma de la URL (#token=…) antes de que el enrutador la toque

  // `npm run dev:mock`: sin backend. La condición se escribe aquí tal cual (y no con ES_MOCK)
  // porque Vite la sustituye por una constante en cada build: así, en producción, este bloque
  // y MSW entero quedan fuera del paquete final.
  if (import.meta.env.MODE === 'mock') {
    const { iniciarMocks } = await import('./mocks/navegador');
    await iniciarMocks();
  }

  iniciarConexion();

  const raiz = document.getElementById('raiz');
  if (!raiz) throw new Error('Falta el elemento #raiz en index.html');
  createRoot(raiz).render(
    <StrictMode>
      <App enrutador={createBrowserRouter(rutas)} consultas={crearClienteConsultas()} />
    </StrictMode>,
  );
}

void arrancar();
