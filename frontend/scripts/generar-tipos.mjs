// Genera src/api/generado/contrato.ts a partir de ../contrato (openapi.json + ws/*.schema.json).
//
//   npm run tipos            → regenera el archivo
//   npm run tipos:verificar  → falla si el archivo no coincide con el contrato (lo usa el CI)
//
// El contrato se genera desde los modelos Pydantic del motor, que marcan como opcional todo campo
// con valor por defecto. Eso es correcto para lo que la interfaz ENVÍA, pero el motor siempre
// serializa todos los campos en lo que RESPONDE y en los eventos. Por eso aquí se marcan como
// obligatorios los campos de todo esquema que el motor emite: así la interfaz no tiene que tratar
// como "posiblemente ausente" algo que siempre llega.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import openapiTS, { astToString } from 'openapi-typescript';

const CONTRATO = new URL('../../contrato/', import.meta.url);
const SALIDA = new URL('../src/api/generado/contrato.ts', import.meta.url);
const REF = '#/components/schemas/';

const leerJson = async (/** @type {URL} */ url) => JSON.parse(await readFile(url, 'utf8'));

/** Reescribe las referencias locales de JSON Schema (#/$defs/X) al estilo OpenAPI. */
const reubicarRefs = (/** @type {unknown} */ nodo) =>
  JSON.parse(JSON.stringify(nodo).replaceAll('"#/$defs/', `"${REF}`));

/** Nombres de esquema referenciados (directa o indirectamente) desde un nodo. */
function alcanzables(/** @type {unknown} */ raiz, /** @type {Record<string, unknown>} */ esquemas) {
  const vistos = new Set();
  const visitar = (/** @type {unknown} */ nodo) => {
    if (Array.isArray(nodo)) return nodo.forEach(visitar);
    if (nodo === null || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave === '$ref' && typeof valor === 'string' && valor.startsWith(REF)) {
        const nombre = valor.slice(REF.length);
        if (!vistos.has(nombre)) {
          vistos.add(nombre);
          visitar(esquemas[nombre]);
        }
      } else {
        visitar(valor);
      }
    }
  };
  visitar(raiz);
  return vistos;
}

/**
 * Copia de un esquema sin sus anotaciones (default, title, description): Pydantic no las emite
 * igual en OpenAPI que en JSON Schema, y no cambian la forma de los datos.
 * @returns {unknown}
 */
function forma(/** @type {unknown} */ nodo, enPropiedades = false) {
  if (Array.isArray(nodo)) return nodo.map((n) => forma(n));
  if (nodo === null || typeof nodo !== 'object') return nodo;
  const anotaciones = enPropiedades ? [] : ['default', 'title', 'description'];
  return Object.fromEntries(
    Object.entries(nodo)
      .filter(([clave]) => !anotaciones.includes(clave))
      .map(([clave, valor]) => [clave, forma(valor, !enPropiedades && clave === 'properties')]),
  );
}

async function construirDocumento() {
  const doc = await leerJson(new URL('openapi.json', CONTRATO));
  const esquemas = doc.components.schemas;
  const emitidos = new Set(); // esquemas que el motor envía (respuestas REST y eventos)

  // 1. Respuestas REST.
  for (const ruta of Object.values(doc.paths)) {
    for (const operacion of Object.values(ruta)) {
      alcanzables(operacion.responses, esquemas).forEach((n) => emitidos.add(n));
    }
  }

  // 2. Eventos WebSocket: cada ws/<tipo>.schema.json pasa a ser un esquema más.
  const archivos = (await readdir(new URL('ws/', CONTRATO))).filter((a) => a.endsWith('.json'));
  /** @type {Record<string, unknown>} */
  const eventos = {};
  for (const archivo of archivos.sort()) {
    const { $defs = {}, ...esquema } = reubicarRefs(
      await leerJson(new URL(`ws/${archivo}`, CONTRATO)),
    );
    for (const [nombre, def] of Object.entries({ ...$defs, [esquema.title]: esquema })) {
      if (!(nombre in esquemas)) {
        esquemas[nombre] = def;
      } else if (!isDeepStrictEqual(forma(esquemas[nombre]), forma(def))) {
        throw new Error(`El esquema "${nombre}" de ws/${archivo} no coincide con openapi.json`);
      }
    }
    const tipo = archivo.replace('.schema.json', '');
    if (tipo !== 'sobre') eventos[tipo] = { $ref: REF + esquema.title };
    alcanzables({ $ref: REF + esquema.title }, esquemas).forEach((n) => emitidos.add(n));
    emitidos.add(esquema.title);
  }

  // 3. Mapa "tipo de evento → datos", para tipar el cliente WebSocket.
  esquemas.EventosWs = {
    title: 'EventosWs',
    description: 'Datos de cada evento WebSocket, por su campo "tipo".',
    type: 'object',
    properties: eventos,
    required: Object.keys(eventos),
  };

  // 4. Lo que el motor emite siempre llega completo.
  for (const nombre of emitidos) {
    const esquema = esquemas[nombre];
    if (esquema?.properties) esquema.required = Object.keys(esquema.properties);
  }
  return doc;
}

const CABECERA = `// GENERADO por scripts/generar-tipos.mjs desde ../contrato — no editar a mano.
// Para actualizarlo: npm run tipos
`;

const generado =
  CABECERA +
  astToString(await openapiTS(await construirDocumento(), { defaultNonNullable: false }));

if (process.argv.includes('--verificar')) {
  const normal = (/** @type {string} */ texto) => texto.replaceAll('\r\n', '\n');
  const actual = await readFile(SALIDA, 'utf8').catch(() => '');
  if (normal(actual) !== normal(generado)) {
    console.error('Los tipos generados no coinciden con el contrato. Ejecuta: npm run tipos');
    process.exit(1);
  }
  console.log('Los tipos generados coinciden con el contrato.');
} else {
  await mkdir(new URL('.', SALIDA), { recursive: true });
  await writeFile(SALIDA, generado);
  console.log('Tipos generados en src/api/generado/contrato.ts');
}
