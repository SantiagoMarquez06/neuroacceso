// Prueba de humo de extremo a extremo contra el MOTOR REAL (no contra los mocks).
//
//   1. cd frontend && npm run build
//   2. cd backend  && uv run python -m neuroacceso_motor --demo --sin-raton --datos prueba.db
//   3. cd frontend && npm run humo -- --token EL_TOKEN_QUE_IMPRIME_EL_MOTOR
//
// Recorre la interfaz servida por el motor (casco simulado): perfil, estado, gestos, comunicador,
// práctica, ajustes e historial. Falla si algo no aparece o si hay errores en la consola.
// Usa el Edge o Chrome instalados. Con --ver se abre la ventana para mirarlo.
import { chromium } from '@playwright/test';

const argumento = (nombre, porDefecto) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? (process.argv[i + 1] ?? porDefecto) : porDefecto;
};
const BASE = argumento('base', 'http://127.0.0.1:8765');
const TOKEN = argumento('token', process.env.NEUROACCESO_TOKEN ?? '');
if (!TOKEN) {
  console.error('Falta el token: npm run humo -- --token EL_TOKEN');
  process.exit(2);
}

const errores = [];
let pasos = 0;
const paso = async (nombre, accion) => {
  process.stdout.write(`· ${nombre}… `);
  await accion();
  pasos += 1;
  console.log('bien');
};

async function abrir() {
  const opciones = { headless: !process.argv.includes('--ver') };
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ ...opciones, channel });
    } catch {
      // siguiente
    }
  }
  return chromium.launch(opciones);
}

const navegador = await abrir();
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
pagina.on('pageerror', (e) => errores.push(e.message));
pagina.on('response', (r) => r.status() >= 500 && errores.push(`${r.status()} ${r.url()}`));

const api = async (metodo, ruta, cuerpo) => {
  const r = await fetch(`${BASE}/api/v1${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return r.status === 204 || r.status === 202 ? null : r.json();
};
const esperar = (localizador) => localizador.first().waitFor({ timeout: 10_000 });
const nombre = `Humo ${Date.now() % 100000}`;

try {
  await paso('abre la interfaz con el token y conecta con el motor', async () => {
    await pagina.goto(`${BASE}/#token=${TOKEN}`);
    await esperar(pagina.getByText('Casco conectado'));
    if (pagina.url().includes('token=')) throw new Error('El token sigue en la URL');
  });

  await paso('crea un perfil y lo activa', async () => {
    await pagina.getByRole('button', { name: 'Nuevo perfil' }).click();
    await pagina.getByLabel('Nombre').fill(nombre);
    await pagina.getByRole('button', { name: /Crear/ }).click();
    await pagina.waitForURL(/\/(preparacion|estado)$/);
    await esperar(pagina.getByRole('link', { name: `Perfil activo: ${nombre}` }));
  });

  await paso('el panel de pruebas dispara un gesto y la app lo muestra', async () => {
    await pagina.goto(`${BASE}/dev`);
    await pagina.getByRole('button', { name: 'Apretar la mandíbula' }).click();
    await esperar(
      pagina.getByRole('status', { name: 'Último gesto' }).getByText(/Apretar la mandíbula/),
    );
  });

  await paso('mal contacto simulado se ve en el mapa', async () => {
    await pagina.getByRole('switch', { name: /Simular mal contacto/ }).click();
    await pagina.goto(`${BASE}/estado`);
    await esperar(pagina.locator('[data-sensor="T7"][data-nivel="malo"]'));
    await api('POST', '/dev/simular/contacto', { malo: false });
  });

  await paso('comunicador: el motor pasa a comunicador y los gestos eligen letras', async () => {
    await pagina.goto(`${BASE}/comunicador`);
    await esperar(pagina.getByText('Comunicador', { exact: true }));
    const estado = await api('GET', '/estado');
    if (estado.modo !== 'comunicador') throw new Error(`modo = ${estado.modo}`);
    // Entra en el grupo resaltado y elige su primer elemento: algo se escribe o se dice.
    await api('POST', '/dev/simular/gesto', { gesto: 'clench' });
    await pagina.waitForTimeout(1200);
    await api('POST', '/dev/simular/gesto', { gesto: 'clench' });
    await pagina
      .getByRole('group', { name: 'Controles' })
      .getByRole('button', { name: 'Salir' })
      .click();
    await pagina.waitForURL(/\/estado$/);
    await pagina.waitForTimeout(300);
    const despues = await api('GET', '/estado');
    if (despues.modo !== 'cursor') throw new Error(`al salir, modo = ${despues.modo}`);
  });

  await paso('práctica: dos bloques y métricas calculadas por el motor', async () => {
    await pagina.goto(`${BASE}/practica`);
    await pagina.getByLabel('Objetivos por bloque').selectOption('9');
    await pagina.getByRole('button', { name: 'Iniciar' }).click();
    for (let bloque = 0; bloque < 2; bloque += 1) {
      if (bloque === 1) await pagina.getByRole('button', { name: 'Continuar' }).click();
      const area = pagina.getByRole('application', { name: 'Área de la práctica' });
      for (let i = 0; i < 10; i += 1) {
        const caja = await area.locator('[data-activo]').boundingBox();
        const dx = i % 2 ? 4 : -4;
        await pagina.mouse.click(caja.x + caja.width / 2 + dx, caja.y + caja.height / 2);
        await pagina.waitForTimeout(120);
      }
    }
    await esperar(pagina.getByText(/bits\/s$/));
  });

  await paso('ajustes: un cambio se guarda en el motor', async () => {
    await pagina.goto(`${BASE}/ajustes`);
    await pagina.getByRole('button', { name: 'Subir Sensibilidad horizontal' }).click();
    await esperar(pagina.getByText('Cambios guardados'));
    await pagina.waitForTimeout(800);
    const estado = await api('GET', '/estado');
    const ajustes = await api('GET', `/perfiles/${estado.perfil_activo_id}/ajustes`);
    if (ajustes.cursor.ganancia_x !== 26)
      throw new Error(`ganancia_x = ${ajustes.cursor.ganancia_x}`);
    ajustes.cursor.ganancia_x = 25;
    await api('PUT', `/perfiles/${estado.perfil_activo_id}/ajustes`, ajustes);
  });

  await paso('historial: aparece la práctica', async () => {
    await pagina.goto(`${BASE}/historial`);
    await esperar(pagina.getByRole('cell', { name: 'Práctica de puntería' }));
  });

  await paso('barra flotante', async () => {
    await pagina.setViewportSize({ width: 640, height: 72 });
    await pagina.goto(`${BASE}/barra`);
    await esperar(pagina.getByText('Cursor activo'));
  });

  if (errores.length)
    throw new Error(`Errores en la consola o del servidor:\n  ${errores.join('\n  ')}`);
  console.log(`\n✓ ${pasos} pasos superados contra el motor real.`);
} catch (error) {
  console.log('FALLÓ');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await navegador.close();
}
