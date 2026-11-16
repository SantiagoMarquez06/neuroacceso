# Contrato entre el motor y la interfaz

Esta carpeta define **cómo se hablan** el motor (`backend/`, Santiago) y la interfaz (`frontend/`, Jonnathan). Es lo único que comparten: mientras ambos cumplan el contrato, cada uno puede trabajar sin esperar al otro.

| Archivo | Qué es |
|---|---|
| [api-v1.md](api-v1.md) | Descripción en prosa de la API v1 (REST + eventos WebSocket). |
| [openapi.json](openapi.json) | Especificación OpenAPI de la parte REST. **Generado.** |
| [ws/](ws/) | JSON Schema del sobre y de cada evento WebSocket. **Generado.** |
| [ejemplos/](ejemplos/) | Ejemplos de eventos (`ws/`) y respuestas (`rest/`) para los mocks de la interfaz. **Generado.** |

Los archivos generados salen de los modelos del motor (`backend/src/neuroacceso_motor/contrato.py`), que son la única fuente de verdad:

```bash
cd backend
uv run python -m neuroacceso_motor.exportar_contrato      # regenerar
```

Un test del motor falla si están desactualizados, así que el código y el contrato nunca divergen. **No edites los archivos generados a mano**: propón el cambio en `contrato.py` (o pídeselo al motor) por PR.

## Reglas
1. Todo cambio entra por un **Pull Request propio** (`contrato/<cambio>`), aprobado por **los dos**, antes de implementarlo.
2. **Añadir** un campo opcional o un evento nuevo es compatible: la interfaz debe ignorar lo que no conoce.
3. **Quitar, renombrar o cambiar el tipo** de algo rompe la compatibilidad: requiere `/api/v2`.
4. Cada versión congelada se etiqueta en Git (`contrato-v1.0`, `contrato-v1.1`, …).
5. El motor valida en sus tests que cada evento emitido cumple su esquema; la interfaz usa los tipos generados desde aquí.
