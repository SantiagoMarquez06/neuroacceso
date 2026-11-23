// Toma capturas de las pantallas con el motor simulado (sin backend ni casco).
//
//   1. En una terminal:  npm run dev:mock
//   2. En otra:          npm run capturas            → ../docs/img/interfaz/*.png
//                        npm run capturas -- --salida otra/carpeta --ancho 1180 --alto 760
//
// Usa el navegador Edge o Chrome ya instalado (no descarga ninguno).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const argumento = (/** @type {string} */ nombre, /** @type {string} */ porDefecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? (process.argv[i + 1] ?? porDefecto) : porDefecto;
};

const BASE = argumento('base', 'http://localhost:5173');
const SALIDA = argumento(
  'salida',
  fileURLToPath(new URL('../../docs/img/interfaz/', import.meta.url)),
);
const ANCHO = Number(argumento('ancho', '1280'));
const ALTO = Number(argumento('alto', '800'));
const SOLO = argumento('solo', '');

/** @typedef {import('@playwright/test').Page} Pagina */
/** @type {{ nombre: string, ruta: string, ancho?: number, alto?: number, antes?: (p: Pagina) => Promise<void> }[]} */
const PANTALLAS = [
  { nombre: '01-estado', ruta: '/estado' },
  { nombre: '02-elegir-perfil', ruta: '/' },
  { nombre: '03-preparacion', ruta: '/preparacion' },
  { nombre: '04-comunicador', ruta: '/comunicador' },
  { nombre: '05-practica', ruta: '/practica' },
  {
    nombre: '05b-practica-en-curso',
    ruta: '/practica',
    antes: async (pagina) => {
      await pagina.getByRole('button', { name: 'Iniciar' }).click();
      await pagina.waitForTimeout(300);
      const area = pagina.getByRole('application', { name: 'Área de la práctica' });
      // Dos clics sobre el objetivo activo: la salida y el primer intento.
      for (let i = 0; i < 2; i += 1) {
        const caja = await area.locator('[data-activo]').boundingBox();
        if (caja) await pagina.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
      }
    },
  },
  { nombre: '06-entrenamiento', ruta: '/entrenamiento' },
  { nombre: '07-ajustes', ruta: '/ajustes' },
  { nombre: '08-perfiles', ruta: '/perfiles' },
  { nombre: '09-historial', ruta: '/historial' },
  { nombre: '10-pruebas', ruta: '/dev' },
  { nombre: '11-barra', ruta: '/barra', ancho: 640, alto: 72 },
  {
    nombre: '12-alto-contraste',
    ruta: '/estado',
    antes: (pagina) =>
      pagina.evaluate(() => {
        document.documentElement.dataset['tema'] = 'contraste';
      }),
  },
];

async function abrirNavegador() {
  for (const canal of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel: canal });
    } catch {
      // probar el siguiente
    }
  }
  return chromium.launch(); // el Chromium de Playwright, si está instalado
}

await mkdir(SALIDA, { recursive: true });
const navegador = await abrirNavegador();
try {
  for (const pantalla of PANTALLAS.filter((p) => !SOLO || p.nombre.includes(SOLO))) {
    const contexto = await navegador.newContext({
      viewport: { width: pantalla.ancho ?? ANCHO, height: pantalla.alto ?? ALTO },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (error) => console.error(`  [${pantalla.nombre}] ${error.message}`));
    await pagina.goto(BASE + pantalla.ruta, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(1500); // llegan `hola`, `dispositivo` y la tipografía
    await pantalla.antes?.(pagina);
    await pagina.waitForTimeout(300);
    const archivo = `${SALIDA}/${pantalla.nombre}.png`;
    await pagina.screenshot({ path: archivo });
    console.log(`✓ ${pantalla.nombre}`);
    await contexto.close();
  }
} finally {
  await navegador.close();
}
