import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { RouterProvider, type DataRouter } from 'react-router';
import { escuchar } from './estado/conexion';

interface PropsApp {
  enrutador: DataRouter;
  consultas: QueryClient;
}

export function App({ enrutador, consultas }: PropsApp) {
  // Cada `hola` (al conectar o reconectar) trae el estado completo del motor: lo que se había
  // consultado por REST puede haber cambiado mientras no había conexión, así que se vuelve a pedir.
  useEffect(() => escuchar('hola', () => void consultas.invalidateQueries()), [consultas]);

  return (
    <QueryClientProvider client={consultas}>
      <RouterProvider router={enrutador} />
    </QueryClientProvider>
  );
}
