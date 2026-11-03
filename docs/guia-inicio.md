# Guía de inicio

Pasos para pasar de "tengo el casco en la caja" a "veo datos en mi programa". Hacer esto **antes** de empezar a programar.

## 1. Instalar el software de Emotiv

1. Crear una cuenta (EmotivID) en https://www.emotiv.com.
2. Descargar e instalar **EMOTIV Launcher** desde la sección de descargas de https://www.emotiv.com (incluye el servicio **Cortex**, que es el que expone la API).
3. Iniciar sesión en el Launcher con la EmotivID y **aceptar el EULA** (si no, la API devuelve una advertencia).
4. Opcional: instalar **EmotivBCI** (desde el Launcher) para entrenar expresiones faciales y comandos mentales.

## 2. Registrar la aplicación y obtener credenciales

1. Entrar a https://www.emotiv.com → cuenta → **Cortex Apps** → *Register a new Cortex App*.
2. Poner un nombre (ej. `NeuroAcceso`) y guardar el **Client ID** y **Client Secret**.
3. Copiar `.env.example` a `.env` y pegarlos ahí:
   ```
   EMOTIV_CLIENT_ID=...
   EMOTIV_CLIENT_SECRET=...
   ```
   ⚠️ El archivo `.env` está en `.gitignore`: **nunca subir las credenciales a GitHub**.

## 3. Preparar el casco

1. Cargar el EPOC X (con el cable USB). **Mientras está conectado por cable no se puede abrir una sesión de datos**: desconectarlo antes de usarlo.
2. Hidratar los fieltros de los 16 sensores con **solución salina** (suero fisiológico). Deben estar húmedos, no goteando.
3. Encender el casco y conectarlo desde el Launcher, por **Bluetooth** o con el **receptor USB** (el receptor suele ser más estable).
4. Colocarlo: los sensores frontales a unos 3 dedos sobre las cejas; las dos referencias (las de goma) sobre el hueso detrás de las orejas.
5. En el mapa de contacto del Launcher, ajustar hasta que todos los sensores estén en **verde**. Apartar el pelo bajo los sensores ayuda.

## 4. Preparar Python

```bash
python --version        # 3.10 o superior
python -m venv .venv
.venv\Scripts\activate
pip install -e .
```

## 5. Primera prueba

```bash
python scripts/probar_conexion.py
```

- La **primera vez**, el EMOTIV Launcher mostrará un aviso pidiendo **aprobar la aplicación**. Aprobarla y volver a ejecutar el script.
- Si todo va bien, se verán en consola los gestos faciales (`fac`), el movimiento (`mot`) y la calidad de contacto (`dev`).
- Probar: apretar la mandíbula → debe aparecer `clench`; guiñar → `winkL`/`winkR`.

## 6. Entrenar (recomendado)

En **EmotivBCI**:
- **Expresiones faciales:** entrenar *neutral*, *clench* y los guiños, y ajustar la sensibilidad. Mejora mucho la precisión.
- **Comandos mentales (fase 4):** entrenar *neutral* y *push* (8–10 repeticiones de cada uno al inicio).

El entrenamiento se guarda en un **perfil** asociado a la EmotivID (se sincroniza en la nube de Emotiv).

## Problemas frecuentes

| Problema | Solución |
|---|---|
| `accessGranted: false` | Aprobar la app en el EMOTIV Launcher y reintentar. |
| No aparece ningún casco | Encenderlo, comprobar Bluetooth/receptor, desconectar el cable USB. |
| `The stream is unavailable or unsupported` en `eeg` | Normal: el EEG crudo requiere licencia de pago. No lo usamos. |
| Gestos que se disparan solos | Mejorar contacto, entrenar *neutral* en EmotivBCI, subir `UMBRAL_POTENCIA` en `config.py`. |
| Error de certificado SSL | Cortex usa un certificado local; el cliente ya lo maneja (`ssl.CERT_NONE` solo para `localhost`). |
