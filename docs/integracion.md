# Integración con el casco real

Guía para los **puntos de integración** (semanas 4, 7 y 11) y para grabar sesiones reales. Todo lo demás del motor se prueba sin casco (simulador y grabaciones).

## Preparación (una vez)
1. EMOTIV Launcher instalado, sesión iniciada y EULA aceptado.
2. Cortex App registrada en emotiv.com → copiar `.env.example` a `.env` en la raíz del repo con `EMOTIV_CLIENT_ID` y `EMOTIV_CLIENT_SECRET`.
3. `cd backend && uv sync`.

## Punto de integración 1 — datos en vivo y cursor
1. Hidratar los sensores, colocar el casco y comprobar contacto verde en el Launcher. **Desconectar el cable de carga.**
2. Arrancar grabando la sesión:
   ```bash
   uv run python -m neuroacceso_motor --grabar grabaciones/integracion-1.jsonl
   ```
   La primera vez, **aprobar NeuroAcceso** en el EMOTIV Launcher (si no, el motor reintenta solo y avisa con `APP_NO_APROBADA`).
3. En otra terminal: `uv run python scripts/cliente_ws.py TOKEN --sin-orientacion`.
4. Verificar, marcando cada punto:
   - [ ] `conexion: conectado` con el id del casco.
   - [ ] `calibracion` avanza hasta `completada` mirando al frente ~2 s, y el modo pasa a `cursor`.
   - [ ] Girar la cabeza mueve el cursor en la dirección correcta (si va al revés: `invertir_x`/`invertir_y` en los ajustes).
   - [ ] Apretar la mandíbula → evento `gesto clench` y `accion clic`.
   - [ ] Guiño izquierdo → `modo pausa`; otra vez → `cursor`.
   - [ ] `dispositivo` muestra batería y contacto por sensor.
   - [ ] Desconectar el casco → `conexion error` / `CASCO_DESCONECTADO`; al volver a encenderlo el motor reconecta solo.
5. Ajustar `ganancia`, `zona_muerta` y `umbral` hasta que el control sea cómodo y anotar los valores.
6. Subir la grabación `grabaciones/integracion-1.jsonl` al repo: con ella corren las pruebas de reproducción con datos reales.

## Punto de integración 2 — comunicador desde el ejecutable
- [ ] `scripts/empaquetar.ps1` genera el ejecutable y abre ventana principal + barra flotante.
- [ ] Con el casco, escribir y decir en voz alta una frase usando solo gestos.
- [ ] Gesto de rescate (cejas arriba) alterna cursor ↔ comunicador.

## Punto de integración 3 — versión candidata
- [ ] Entrenamiento de *neutral* y *push* desde la interfaz.
- [ ] Práctica de puntería completa: las métricas aparecen en el historial y en `GET /api/v1/sesiones/exportar.csv`.
- [ ] Latencia p50/p95 en `GET /api/v1/estado` por debajo de 30 ms.
