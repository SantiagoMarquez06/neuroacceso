// Mapa de pantallas (docs/pantallas.md §2).
import type { RouteObject } from 'react-router';
import { Armazon } from './estructura/Armazon';
import { ErrorDeRuta } from './estructura/ErrorDeRuta';
import { EstadoCasco } from './pantallas/estado/EstadoCasco';
import { EnConstruccion, NoEncontrada } from './pantallas/Provisional';

export const rutas: RouteObject[] = [
  {
    element: <Armazon />,
    errorElement: <ErrorDeRuta />,
    children: [
      { index: true, element: <EnConstruccion titulo="Elegir perfil" /> },
      { path: 'preparacion', element: <EnConstruccion titulo="Preparación" /> },
      { path: 'estado', element: <EstadoCasco /> },
      { path: 'comunicador', element: <EnConstruccion titulo="Comunicador" /> },
      { path: 'practica', element: <EnConstruccion titulo="Práctica de puntería" /> },
      { path: 'entrenamiento', element: <EnConstruccion titulo="Entrenamiento" /> },
      { path: 'ajustes', element: <EnConstruccion titulo="Ajustes" /> },
      { path: 'perfiles', element: <EnConstruccion titulo="Perfiles" /> },
      { path: 'historial', element: <EnConstruccion titulo="Historial" /> },
      { path: 'historial/:sesionId', element: <EnConstruccion titulo="Detalle de la sesión" /> },
      { path: 'dev', element: <EnConstruccion titulo="Panel de pruebas" /> },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
  // La barra flotante es una ventana aparte: no lleva la estructura común.
  {
    path: 'barra',
    element: <EnConstruccion titulo="Barra flotante" />,
    errorElement: <ErrorDeRuta />,
  },
];
