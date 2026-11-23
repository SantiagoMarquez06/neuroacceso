// Mapa de pantallas (docs/pantallas.md §2).
import type { RouteObject } from 'react-router';
import { Armazon } from './estructura/Armazon';
import { ErrorDeRuta } from './estructura/ErrorDeRuta';
import { Ajustes } from './pantallas/ajustes/Ajustes';
import { BarraFlotante } from './pantallas/barra/BarraFlotante';
import { Comunicador } from './pantallas/comunicador/Comunicador';
import { PanelPruebas } from './pantallas/dev/PanelPruebas';
import { Entrenamiento } from './pantallas/entrenamiento/Entrenamiento';
import { EstadoCasco } from './pantallas/estado/EstadoCasco';
import { ElegirPerfil } from './pantallas/perfiles/ElegirPerfil';
import { Perfiles } from './pantallas/perfiles/Perfiles';
import { Practica } from './pantallas/practica/Practica';
import { Preparacion } from './pantallas/preparacion/Preparacion';
import { EnConstruccion, NoEncontrada } from './pantallas/Provisional';

export const rutas: RouteObject[] = [
  {
    element: <Armazon />,
    errorElement: <ErrorDeRuta />,
    children: [
      { index: true, element: <ElegirPerfil /> },
      { path: 'preparacion', element: <Preparacion /> },
      { path: 'estado', element: <EstadoCasco /> },
      { path: 'comunicador', element: <Comunicador /> },
      { path: 'practica', element: <Practica /> },
      { path: 'entrenamiento', element: <Entrenamiento /> },
      { path: 'ajustes', element: <Ajustes /> },
      { path: 'perfiles', element: <Perfiles /> },
      { path: 'historial', element: <EnConstruccion titulo="Historial" /> },
      { path: 'historial/:sesionId', element: <EnConstruccion titulo="Detalle de la sesión" /> },
      { path: 'dev', element: <PanelPruebas /> },
      { path: '*', element: <NoEncontrada /> },
    ],
  },
  // La barra flotante es una ventana aparte: no lleva la estructura común.
  {
    path: 'barra',
    element: <BarraFlotante />,
    errorElement: <ErrorDeRuta />,
  },
];
