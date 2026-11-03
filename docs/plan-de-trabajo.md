# Plan de trabajo

Duración total estimada: **9–12 semanas**. Cada fase termina con una demostración funcional.

## Roles sugeridos (equipo de 3–4 personas)

| Rol | Responsabilidades |
|---|---|
| **Integración con Emotiv** | `cortex_client.py`, pruebas de conexión, perfiles y entrenamiento en EmotivBCI |
| **Control del PC** | `head_mouse.py`, `gestos.py`, calibración y ajuste de sensibilidad |
| **Interfaz / comunicador** | `comunicador.py`, diseño de la pantalla, voz, frases rápidas |
| **Pruebas y documentación** | Protocolo de pruebas, métricas, encuestas SUS, informe y presentación |

## Fase 0 — Preparación (semana 1)
- [ ] Crear EmotivID, instalar EMOTIV Launcher y EmotivBCI.
- [ ] Registrar la Cortex App y obtener Client ID / Secret.
- [ ] Aprender a colocar el casco y obtener contacto verde en todos los sensores.
- [ ] Ejecutar `scripts/probar_conexion.py` y ver `fac`, `mot` y `dev` en consola.
- [ ] Ejecutar `getDetectionInfo` para confirmar la lista de gestos del casco.
- **Entregable:** captura/video de los datos llegando al programa.

## Fase 1 — Cursor con la cabeza (semanas 2–3)
- [ ] Identificar qué columnas entrega `mot` en este EPOC X (cuaterniones o giroscopio).
- [ ] Calibración del centro al inicio.
- [ ] Ajustar ganancia y zona muerta; probar con varias personas.
- [ ] (Opcional) Suavizado con media móvil para reducir temblor.
- **Entregable:** mover el cursor por toda la pantalla con la cabeza.

## Fase 2 — Gestos → clics (semanas 4–5)
- [ ] Entrenar `neutral`, `clench` y guiños en EmotivBCI.
- [ ] Mapear gestos a clic, clic derecho y pausa (`config.MAPEO_GESTOS`).
- [ ] Ajustar umbrales y anti-rebote; medir falsos positivos por minuto.
- [ ] Indicador visual/sonoro cuando se reconoce un gesto.
- **Entregable:** abrir una carpeta y un archivo usando solo la cabeza y la cara.

## Fase 3 — Comunicador (semanas 6–8)
- [ ] Teclado con barrido por filas y columnas.
- [ ] Frases rápidas configurables.
- [ ] Texto a voz en español.
- [ ] (Opcional) Predicción de palabras simple con un diccionario de palabras frecuentes.
- **Entregable:** escribir y decir en voz alta una frase usando solo gestos.

## Fase 4 — Comando mental (opcional, semanas 8–9)
- [ ] Entrenar `push` en EmotivBCI.
- [ ] Suscribirse a `com` y usar `push` con intensidad > umbral como acción alternativa a `seleccionar`.
- [ ] Comparar precisión frente a los gestos faciales.

## Fase 5 — Pruebas y presentación (semanas 10–12)
- [ ] Protocolo de pruebas con 5–10 voluntarios (con consentimiento informado).
- [ ] Medir: precisión de gestos, caracteres/minuto, tiempo de puntería, cuestionario SUS.
- [ ] Informe final, video demostrativo y presentación.

## Ideas de extensión
- Indicador de calidad de contacto en pantalla (stream `dev`).
- Perfiles por usuario con su propia sensibilidad.
- Control de domótica o de un juego simple con los mismos gestos.
- Panel de neurofeedback con el stream `pow` (bandas de potencia).
