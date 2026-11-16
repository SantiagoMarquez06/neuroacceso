# Protocolo de pruebas con usuarios — NeuroAcceso v1

## 1. Objetivo
Medir el desempeño y la usabilidad de NeuroAcceso en el control del computador y la comunicación usando solo el casco Emotiv EPOC X.

## 2. Participantes
- **5 a 10 voluntarios adultos**, sin contraindicaciones para usar un casco EEG (lesiones en el cuero cabelludo, alergia a la solución salina).
- La versión 1.0 se evalúa con personas sin discapacidad motora. Las pruebas con usuarios con discapacidad se harán en una fase posterior, con una institución de salud y aval ético propio.
- Participación **voluntaria**, con **consentimiento informado** firmado (sección 8) y el aval de la instancia de ética de la universidad.

## 3. Materiales
- PC con Windows 10/11 y la aplicación NeuroAcceso (ejecutable o `python -m neuroacceso_motor`).
- Casco EPOC X cargado, solución salina y receptor USB.
- Este protocolo, formulario de consentimiento y cuestionario SUS (sección 7).

## 4. Preparación (≈ 10 min)
1. Explicar el estudio, resolver dudas y firmar el consentimiento.
2. Crear un **perfil anónimo** (`P01`, `P02`…). No registrar nombres en el sistema.
3. Hidratar los sensores, colocar el casco y verificar **contacto ≥ 80 %** en la pantalla de estado.
4. Completar el asistente de preparación: calibración del centro y prueba de gestos.
5. Período de familiarización: **5 minutos** de uso libre del cursor.

## 5. Tareas
Sesiones de **20 minutos como máximo**, con pausas cuando el participante lo pida.

| # | Tarea | Sesión en el sistema | Qué se mide |
|---|---|---|---|
| T1 | **Práctica de puntería ISO 9241-411:** 2 bloques de 15 objetivos en círculo (anchos 40 px y 80 px) | `practica` | Rendimiento (bits/s), tiempo medio, precisión, falsos positivos/min |
| T2 | **Copiar frases** en el comunicador: «HOLA», «TENGO SED», «NECESITO AYUDA» | `comunicador` | Caracteres/min, selecciones y correcciones por frase |
| T3 | **Frase libre** elegida por el participante y pronunciada con la voz del sistema | `comunicador` | Caracteres/min, finalización de la tarea |
| T4 | **Tarea real:** abrir el explorador de archivos y abrir un documento indicado usando solo la cabeza y los gestos | `libre` | Tiempo total, finalización (sí/no), pausas |

Para cada tarea se registra también en la hoja de observación: incidencias, ayudas dadas y comentarios espontáneos.

## 6. Métricas y obtención de datos
El motor calcula y guarda las métricas al finalizar cada sesión:

| Métrica | Definición |
|---|---|
| Rendimiento (throughput) | Método de ancho efectivo ISO 9241-411: IDe / MT, promediado entre condiciones (bits/s) |
| Tiempo medio por objetivo | Media del tiempo de movimiento de los intentos (ms) |
| Precisión | Clics dentro del objetivo / clics totales |
| Falsos positivos por minuto | Clics fuera del objetivo por minuto de sesión |
| Caracteres por minuto | Caracteres escritos / tiempo de composición |
| Latencia del sistema | p50 y p95 desde la llegada del dato del casco hasta la acción (`GET /api/v1/estado`) |

**Exportación:** `GET /api/v1/sesiones/exportar.csv` (todas las sesiones) o `?perfil_id=…` (un participante). El CSV contiene el identificador anónimo, el tipo de sesión, las fechas y todas las métricas.

## 7. Cuestionario de usabilidad (SUS)
Al terminar, el participante valora cada afirmación de **1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo)**:

1. Creo que me gustaría usar este sistema con frecuencia.
2. Encontré el sistema innecesariamente complejo.
3. Pensé que el sistema era fácil de usar.
4. Creo que necesitaría el apoyo de un técnico para poder usar este sistema.
5. Encontré que las diversas funciones del sistema estaban bien integradas.
6. Pensé que había demasiada inconsistencia en el sistema.
7. Imagino que la mayoría de las personas aprendería a usar este sistema muy rápidamente.
8. Encontré el sistema muy difícil de usar.
9. Me sentí muy seguro usando el sistema.
10. Necesité aprender muchas cosas antes de poder empezar a usar el sistema.

**Puntuación:** ítems impares → (valor − 1); ítems pares → (5 − valor); suma × 2,5 = puntuación de 0 a 100. Una puntuación de 68 o más se considera por encima del promedio (Brooke, 1996).

## 8. Consentimiento informado (resumen del contenido)
- Propósito del estudio y descripción de las tareas.
- Duración (≤ 40 min en total) y posibles molestias (presión del casco, humedad de la solución salina).
- Participación voluntaria y derecho a retirarse en cualquier momento sin consecuencias.
- Confidencialidad: datos anónimos, almacenados localmente y usados solo con fines académicos.
- Contacto de los investigadores y de la instancia de ética.
- Firma del participante y fecha.

## 9. Manejo de los datos
- La base de datos local solo contiene identificadores anónimos.
- Los CSV exportados se guardan en una carpeta del proyecto con acceso restringido al equipo.
- Las grabaciones de señal (`--grabar`) solo se hacen con consentimiento explícito y también son anónimas.

## 10. Análisis
- Estadística descriptiva por tarea (media, desviación estándar, mínimo, máximo).
- Curva de aprendizaje: comparación entre el primer y el segundo bloque de puntería.
- Puntuación SUS media y su distribución.
- Síntesis cualitativa de observaciones y comentarios.
