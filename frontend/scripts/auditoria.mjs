// Auditoría de accesibilidad automática de todas las pantallas (issue #44).
//
//   1. npm run dev:mock     (otra terminal)
//   2. npm run auditoria    → informe en consola; con --json guarda los datos crudos
//
// Para cada pantalla y tema (oscuro y alto contraste):
//   - axe-core (WCAG 2.2 A/AA): contraste, nombres accesibles, roles, etiquetas…
//   - Objetivos: todo lo que se pulsa mide ≥ 64 × 64 px (docs/pantallas.md §1.1).
//     Excepción documentada: enlaces dentro de un párrafo de texto.
//   - Foco visible: al tabular, cada control muestra un contorno de ≥ 3 px.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:5173';
const MINIMO = 64;

const PANTALLAS = [
  ['Inicio', '/'],
  ['Preparación', '/preparacion'],
  ['Estado del casco', '/estado'],
  ['Comunicador', '/comunicador'],
  ['Práctica', '/practica'],
  ['Entrenamiento', '/entrenamiento'],
  ['Ajustes', '/ajustes'],
  ['Perfiles', '/perfiles'],
  ['Historial', '/historial'],
  ['Panel de pruebas', '/dev'],
  ['Barra flotante', '/barra'],
];

const axe = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

async function abrir() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // siguiente
    }
  }
  return chromium.launch();
}

/** Controles pulsables más pequeños que el mínimo (se ejecuta en la página). */
function objetivosPequenos(minimo) {
  const selector = 'button, a[href], select, input, [role="switch"], [role="tab"], summary';
  return [...document.querySelectorAll(selector)]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false; // oculto
      if (el.closest('.solo-lectores')) return false;
      if (el.type === 'range') return false; // la barra va con botones − y + de 64 px
      // Enlace dentro de un párrafo: excepción de WCAG 2.5.8 ("inline").
      if (
        el.tagName === 'A' &&
        el.closest('p, li, td') &&
        getComputedStyle(el).display === 'inline'
      )
        return false;
      return r.width < minimo - 0.5 || r.height < minimo - 0.5;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      const nombre = (el.getAttribute('aria-label') || el.textContent || el.tagName)
        .trim()
        .slice(0, 40);
      return `${el.tagName.toLowerCase()} «${nombre}» ${Math.round(r.width)}×${Math.round(r.height)}`;
    });
}

/** Tabula por toda la página y apunta los controles sin contorno de foco visible. */
async function focoInvisible(pagina) {
  const sinFoco = [];
  await pagina.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 60; i += 1) {
    await pagina.keyboard.press('Tab');
    const dato = await pagina.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const e = getComputedStyle(el);
      const contorno = e.outlineStyle !== 'none' ? parseFloat(e.outlineWidth) : 0;
      const nombre = (el.getAttribute('aria-label') || el.textContent || el.tagName)
        .trim()
        .slice(0, 40);
      return { nombre, contorno, id: el.outerHTML.slice(0, 80) };
    });
    if (!dato) break;
    if (sinFoco.some((s) => s.id === dato.id)) break; // dio la vuelta
    if (dato.contorno < 3) sinFoco.push(dato);
  }
  return sinFoco.map((d) => `«${d.nombre}» contorno ${d.contorno}px`);
}

const navegador = await abrir();
const informe = [];
let problemas = 0;
try {
  for (const tema of ['oscuro', 'contraste']) {
    for (const [nombre, ruta] of PANTALLAS) {
      const barra = ruta === '/barra';
      const contexto = await navegador.newContext({
        viewport: barra ? { width: 640, height: 72 } : { width: 1280, height: 800 },
        reducedMotion: 'reduce',
      });
      await contexto.addInitScript((t) => {
        localStorage.setItem(
          'neuroacceso.apariencia',
          JSON.stringify({ tema: t, texto: 'normal' }),
        );
      }, tema);
      const pagina = await contexto.newPage();
      await pagina.goto(BASE + ruta, { waitUntil: 'networkidle' });
      await pagina.waitForTimeout(1200);
      await pagina.addScriptTag({ content: axe });
      const axeRes = await pagina.evaluate(async () => {
        const r = await axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
        return r.violations.map((v) => ({
          regla: v.id,
          impacto: v.impact,
          ayuda: v.help,
          nodos: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
        }));
      });
      const pequenos = await pagina.evaluate(objetivosPequenos, MINIMO);
      const foco = await focoInvisible(pagina);
      const total = axeRes.length + pequenos.length + foco.length;
      problemas += total;
      informe.push({ tema, nombre, ruta, axe: axeRes, pequenos, foco });
      console.log(
        `${total === 0 ? '✓' : '✗'} [${tema}] ${nombre}: axe ${axeRes.length} · objetivos pequeños ${pequenos.length} · sin foco visible ${foco.length}`,
      );
      for (const v of axeRes)
        console.log(`    axe ${v.regla} (${v.impacto}): ${v.ayuda} → ${v.nodos.join(' | ')}`);
      for (const p of pequenos) console.log(`    pequeño: ${p}`);
      for (const f of foco) console.log(`    foco: ${f}`);
      await contexto.close();
    }
  }
} finally {
  await navegador.close();
}

if (process.argv.includes('--json')) {
  await writeFile('auditoria.json', JSON.stringify(informe, null, 2));
  console.log('Datos en frontend/auditoria.json');
}
console.log(problemas === 0 ? '\nSin problemas.' : `\n${problemas} problemas.`);
process.exitCode = problemas === 0 ? 0 : 1;
