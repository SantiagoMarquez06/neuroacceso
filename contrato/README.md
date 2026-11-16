# Contrato entre el motor y la interfaz

Esta carpeta define **cómo se hablan** el motor (`backend/`, Santiago) y la interfaz (`frontend/`, Jonnathan). Es lo único que comparten: mientras ambos cumplan el contrato, cada uno puede trabajar sin esperar al otro.

| Archivo | Estado |
|---|---|
| [api-v1.md](api-v1.md) | **Borrador** de la API v1 (REST + eventos WebSocket). Se revisa y congela en la semana 1. |
| `openapi.yaml` | *(F0)* Versión formal de la parte REST. |
| `ws/*.schema.json` | *(F0)* JSON Schema de cada evento WebSocket. |
| `ejemplos/*.json` | *(F0)* Ejemplos de respuestas y eventos. Alimentan los mocks de la interfaz y los tests del motor. |

## Reglas
1. Todo cambio entra por un **Pull Request propio** (`contrato/<cambio>`), aprobado por **los dos**, antes de implementarlo.
2. **Añadir** un campo opcional o un evento nuevo es compatible: la interfaz debe ignorar lo que no conoce.
3. **Quitar, renombrar o cambiar el tipo** de algo rompe la compatibilidad: requiere `/api/v2`.
4. Cada versión congelada se etiqueta en Git (`contrato-v1.0`, `contrato-v1.1`, …).
5. El motor valida en sus tests que cada evento emitido cumple su esquema; la interfaz usa los tipos generados desde aquí.
