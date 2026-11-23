# Auditoría de accesibilidad de la interfaz — NeuroAcceso v1

| | |
|---|---|
| **Fecha** | 23 de noviembre de 2026 |
| **Alcance** | Las 11 pantallas de `docs/pantallas.md`, en tema oscuro y en alto contraste (22 combinaciones) |
| **Versión** | rama `interfaz/v1` |
| **Issue** | #44 |
| **Cómo repetirla** | `cd frontend && npm run dev:mock` y, en otra terminal, `npm run auditoria` |

## 1. Resultado

**0 problemas** en las 22 combinaciones, tras corregir los 3 que encontró la primera pasada (24 avisos, porque dos se repetían en todas las pantallas).

| Comprobación | Criterio | Antes | Después |
|---|---|---|---|
| Reglas automáticas (axe-core 4.14) | WCAG 2.2 A y AA | 4 | 0 |
| Tamaño de lo que se pulsa | ≥ 64 × 64 px (`docs/pantallas.md` §1.1) | 20 | 0 |
| Foco de teclado visible | contorno ≥ 3 px en cada control al tabular | 0 | 0 |
| Contraste de los colores del tema | 4,5:1 texto, 3:1 controles (WCAG 1.4.3 y 1.4.11) | 0 | 0 |

El contraste se comprueba además en cada `npm test`: `frontend/src/estilos/contraste.test.ts` lee los colores reales de `tokens.css` y falla si un par baja del mínimo. Las relaciones de cada color están en [frontend/README.md](../frontend/README.md#contraste-verificado-wcag-aa).

## 2. Problemas encontrados y corregidos

| # | Problema | Dónde | Por qué importa | Corrección |
|---|---|---|---|---|
| 1 | El enlace "Saltar al contenido" medía 50 px de alto | todas las pantallas | Incumple el mínimo de 64 px del proyecto | Alto mínimo de 64 px |
| 2 | Durante la calibración del asistente no quedaba nada enfocable en la pantalla (Repetir y Continuar desactivados) | Preparación | Con el teclado no había forma de salir del paso; axe: `scrollable-region-focusable` | "Saltar" funciona siempre; si la calibración está en curso, la cancela |
| 3 | `aria-label` en un párrafo sin rol | Barra flotante | Atributo no permitido: los lectores de pantalla lo ignoran (axe: `aria-prohibited-attr`) | Texto oculto "Último gesto:" dentro del párrafo |
| 4 | Con el texto "muy grande" (140 %), las filas del teclado del comunicador quedaban por debajo del borde de la ventana mientras el barrido las resaltaba | Comunicador | Quien usa el barrido no puede desplazar la página: elegiría a ciegas | Cada grupo resaltado se desplaza a la vista (`Resaltado`) |

El problema 4 no lo detecta ninguna herramienta automática: salió de la revisión manual del punto 4.

## 3. Método

### 3.1 Automático (`frontend/scripts/auditoria.mjs`)
Para cada pantalla y tema, con el motor simulado (`npm run dev:mock`) y movimiento reducido:
1. **axe-core** con las reglas WCAG 2.0/2.1/2.2 de nivel A y AA.
2. **Objetivos pequeños:** mide con `getBoundingClientRect` cada botón, enlace, campo, pestaña e interruptor visible. Excepciones: enlaces dentro de un párrafo (excepción "en línea" de WCAG 2.5.8) y la barra de los deslizadores, que siempre va acompañada de botones − y + de 64 px.
3. **Foco visible:** recorre la página con Tab y anota los controles cuyo contorno de foco mide menos de 3 px.

### 3.2 Pruebas automáticas que protegen lo corregido
- 373 pruebas (Vitest + Testing Library) buscan los elementos **por su rol y su nombre accesible**, igual que un lector de pantalla: si un botón pierde su nombre, la prueba falla.
- ESLint con `eslint-plugin-jsx-a11y` revisa el código en cada cambio y en el CI.

### 3.3 Revisión manual
| Qué | Resultado |
|---|---|
| Uso solo con teclado (Tab, flechas en pestañas, Escape en diálogos) | Todo alcanzable; los diálogos atrapan el foco y lo devuelven al cerrarse |
| Texto al 120 % y al 140 % (Ajustes → Apariencia) | Sin desbordes horizontales en Estado, Comunicador y Ajustes; problema 4 corregido |
| Movimiento reducido (`prefers-reduced-motion`) | Se desactivan las animaciones (cursor del texto, cubo del entrenamiento, desplazamientos) |
| El color nunca es la única señal | Estados con forma distinta (círculo, triángulo, cuadrado, anillo), mapa de sensores con relleno/trazo distinto y texto equivalente, barrido con relleno y grosor además del color |
| Lenguaje | Sin jerga técnica: los códigos de error y los nombres de los sensores se traducen ("sobre la oreja izquierda", no "T7") |

## 4. Uso solo con el casco

| Pantalla | Cómo la usa el usuario principal sin manos |
|---|---|
| Comunicador | **Barrido** completo con el gesto de seleccionar (y atrás); probado de principio a fin en las pruebas automáticas |
| Preparación | Los pasos 3 y 4 avanzan solos al calibrar y al reconocer cada gesto |
| Estado, Práctica, Entrenamiento, Barra flotante | Cursor con la cabeza + clic con el gesto, sobre objetivos de ≥ 64 px sin depender del *hover* |
| Ajustes, Perfiles, Historial, Panel de pruebas | Pensadas para el acompañante (ratón y teclado), sin romper la accesibilidad |

El gesto de rescate lleva siempre al comunicador o lo cierra, desde cualquier pantalla: el usuario nunca queda atrapado.

## 5. Límites de esta auditoría (pendiente)

- **No se probó con un lector de pantalla real** (NVDA o Narrador). Las pruebas usan roles y nombres accesibles, pero conviene una pasada con NVDA antes de las pruebas con usuarios.
- **No se probó con el casco real.** Las pruebas usan el casco simulado; los tiempos de barrido y el tamaño de los objetivos deben confirmarse en el punto de integración 2 (#32).
- El **barrido** solo está en el comunicador, que es donde lo pide la especificación; las demás pantallas del usuario principal se usan con el cursor.
- La auditoría automática revisa el estado inicial de cada pantalla; los diálogos y las fases intermedias (práctica en curso, toma de entrenamiento) se cubren con las pruebas de componentes y la revisión manual.
