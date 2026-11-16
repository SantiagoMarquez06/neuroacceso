"""Parámetros ajustables de NeuroAcceso. Cambiar aquí, no en el código."""

import os

from dotenv import load_dotenv

load_dotenv()

# --- Credenciales (desde .env, nunca en el código) -------------------------
CLIENT_ID = os.getenv("EMOTIV_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("EMOTIV_CLIENT_SECRET", "")
CORTEX_URL = os.getenv("EMOTIV_CORTEX_URL", "wss://localhost:6868")

# --- Cursor con la cabeza ---------------------------------------------------
GANANCIA_X = 25.0         # píxeles por grado (cuaterniones) o por unidad de giroscopio
GANANCIA_Y = 25.0
ZONA_MUERTA = 0.3         # cambios menores a esto se ignoran (grados / unidades)
INVERTIR_X = False
INVERTIR_Y = False
MUESTRAS_CALIBRACION = 60  # ~1–2 s mirando al frente al iniciar
SUAVIZADO = 0.5            # 0 = sin suavizado, 0.9 = muy suave (y más lento)

# --- Gestos faciales --------------------------------------------------------
# Acciones posibles: "clic", "clic_derecho", "doble_clic", "pausar", "seleccionar"
# Claves: valores de eyeAct (ojos), uAct (cara superior) o lAct (cara inferior).
# Comprobar los nombres exactos con getDetectionInfo (scripts/probar_conexion.py --info).
MAPEO_GESTOS_CURSOR = {
    "clench": "clic",          # apretar la mandíbula
    "winkR": "clic_derecho",   # guiño derecho
    "winkL": "pausar",         # guiño izquierdo: pausa / reanuda el cursor
}
MAPEO_GESTOS_COMUNICADOR = {
    "clench": "seleccionar",
    "winkR": "seleccionar",
}
UMBRAL_POTENCIA = 0.4  # intensidad mínima (0–1) para gestos de cara superior/inferior
COOLDOWN_S = 1.0       # tiempo mínimo entre dos acciones

# --- Comunicador ------------------------------------------------------------
TIEMPO_BARRIDO_S = 1.2
FILAS_TECLADO = [
    list("ABCDEF"),
    list("GHIJKL"),
    list("MNÑOPQ"),
    list("RSTUVW"),
    list("XYZ.,?"),
    ["ESPACIO", "BORRAR", "HABLAR", "LIMPIAR"],
]
FRASES_RAPIDAS = [
    "Sí",
    "No",
    "Tengo sed",
    "Tengo dolor",
    "Necesito ayuda",
    "Gracias",
]
VELOCIDAD_VOZ = 150  # palabras por minuto
