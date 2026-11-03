# Riesgos y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Mal contacto de los sensores (señal ruidosa) | Alta | Medio | Protocolo de colocación, hidratar bien, revisar el mapa de contacto antes de cada sesión, mostrar `dev` en pantalla. |
| Falsos positivos (clics no deseados) | Media | Alto | Entrenar *neutral*, umbrales de potencia, anti-rebote, gesto de pausa, no usar el parpadeo normal (es involuntario). |
| Los comandos mentales no alcanzan buena precisión | Alta | Bajo | Son opcionales; la entrada principal son gestos e IMU. |
| Cambios en la API o en el software de Emotiv | Baja | Medio | Leer siempre las `cols` de `subscribe`; aislar la API en `cortex_client.py`. |
| Funciones que requieran licencia de pago | Baja | Medio | Diseño basado solo en streams gratuitos (`fac`, `mot`, `dev`, `com`). |
| Un solo casco para todo el equipo | Alta | Medio | Modo `--simular` para desarrollar sin casco; turnos de pruebas con el casco. |
| Fatiga del usuario en sesiones largas | Media | Medio | Sesiones de prueba cortas (≤ 20 min), pausas, gestos de bajo esfuerzo. |
| Aspectos éticos con voluntarios | Media | Alto | Consentimiento informado, datos anónimos, no presentar el prototipo como dispositivo médico. |
