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
import { DetalleSesion, Historial } from './pantallas/historial/Historial';
import { ElegirPerfil } from './pantallas/perfiles/ElegirPerfil';
import { Perfiles } from './pantallas/perfiles/Perfiles';
import { Practica } from './pantallas/practica/Practica';
import { Preparacion } from './pantallas/preparacion/Preparacion';
import { NoEncontrada } from './pantallas/NoEncontrada';

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
      { path: 'historial', element: <Historial /> },
      { path: 'historial/:sesionId', element: <DetalleSesion /> },
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
