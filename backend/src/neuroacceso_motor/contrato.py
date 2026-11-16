"""Contrato API v1: única fuente de verdad de los datos entre motor e interfaz.

`scripts/exportar_contrato.py` genera desde aquí contrato/openapi.json, contrato/ws/*.schema.json
y contrato/ejemplos/*.json. Ver contrato/api-v1.md para la descripción en prosa.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

API_VERSION = 1

Modo = Literal["desconectado", "calibrando", "cursor", "comunicador", "pausa", "entrenando"]
Accion = Literal[
    "clic", "clic_derecho", "doble_clic", "pausar", "seleccionar", "atras", "cambiar_modo",
    "ninguna",
]
Fuente = Literal["cortex", "simulador", "replay"]
CodigoError = Literal[
    "CORTEX_NO_DISPONIBLE", "APP_NO_APROBADA", "SIN_CASCO", "CASCO_DESCONECTADO",
    "TOKEN_CORTEX_EXPIRADO", "PERFIL_NO_ENCONTRADO", "MODO_INVALIDO", "VALIDACION",
    "NO_AUTORIZADO", "ORIGEN_NO_PERMITIDO",
]
EstadoConexion = Literal["desconectado", "conectando", "conectado", "error"]


# ------------------------------------------------------------------ REST
class Error(BaseModel):
    codigo: CodigoError
    mensaje: str
    detalle: dict[str, Any] | None = None


class Salud(BaseModel):
    version: str
    api_version: int = API_VERSION
    fuente: Fuente
    demo: bool


class Conexion(BaseModel):
    estado: EstadoConexion = "desconectado"
    casco_id: str | None = None
    detalle: str | None = None


class Latencia(BaseModel):
    p50: float = 0
    p95: float = 0


class Estado(BaseModel):
    conexion: Conexion = Field(default_factory=Conexion)
    modo: Modo = "desconectado"
    pausado: bool = False
    calibrado: bool = False
    perfil_activo_id: str | None = None
    latencia_ms: Latencia = Field(default_factory=Latencia)


class Perfil(BaseModel):
    id: str
    nombre: str
    cortex_profile: str | None = None
    creado_en: str


class PerfilCrear(BaseModel):
    nombre: str = Field(min_length=1, max_length=60)
    cortex_profile: str | None = Field(default=None, max_length=60)


class PerfilEditar(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=60)
    cortex_profile: str | None = Field(default=None, max_length=60)


class AjustesCursor(BaseModel):
    ganancia_x: float = Field(25, ge=1, le=100)
    ganancia_y: float = Field(25, ge=1, le=100)
    zona_muerta: float = Field(0.3, ge=0, le=5)
    suavizado: float = Field(0.5, ge=0, le=0.95)
    invertir_x: bool = False
    invertir_y: bool = False


class MapeoGestos(BaseModel):
    cursor: dict[str, Accion] = {"clench": "clic", "winkR": "clic_derecho", "winkL": "pausar"}
    comunicador: dict[str, Accion] = {"clench": "seleccionar", "winkR": "seleccionar"}


class AjustesGestos(BaseModel):
    umbral: float = Field(0.4, ge=0.05, le=1)
    cooldown_ms: int = Field(1000, ge=100, le=5000)
    mapeo: MapeoGestos = MapeoGestos()
    gesto_rescate: str = "surprise"


class AjustesDwell(BaseModel):
    activo: bool = False
    ms: int = Field(1000, ge=300, le=5000)
    radio_px: int = Field(30, ge=5, le=200)


class AjustesComunicador(BaseModel):
    tiempo_barrido_ms: int = Field(1200, ge=300, le=5000)
    frases: list[str] = ["Sí", "No", "Tengo sed", "Tengo dolor", "Necesito ayuda", "Gracias"]
    disposicion: Literal["abc", "frecuencia"] = "abc"


class AjustesVoz(BaseModel):
    voz_id: str | None = None
    velocidad: int = Field(150, ge=50, le=300)


class Ajustes(BaseModel):
    version: Literal[1] = 1
    cursor: AjustesCursor = AjustesCursor()
    gestos: AjustesGestos = AjustesGestos()
    dwell: AjustesDwell = AjustesDwell()
    comunicador: AjustesComunicador = AjustesComunicador()
    voz: AjustesVoz = AjustesVoz()


class CambioModo(BaseModel):
    modo: Literal["cursor", "comunicador", "pausa"]


class ModoActual(BaseModel):
    modo: Modo
    pausado: bool


class Metricas(BaseModel):
    throughput_bps: float | None = None
    tiempo_medio_ms: float | None = None
    precision: float | None = None
    falsos_positivos_min: float | None = None
    caracteres_min: float | None = None


class Sesion(BaseModel):
    id: str
    perfil_id: str
    tipo: Literal["libre", "practica", "comunicador"]
    inicio: str
    fin: str | None = None
    metricas: Metricas | None = None


class Punto(BaseModel):
    x: float
    y: float


class Objetivo(Punto):
    ancho: float = Field(gt=0)


class Intento(BaseModel):
    n: int = Field(ge=0)
    t_inicio_ms: float
    t_fin_ms: float
    objetivo: Objetivo
    origen: Punto
    clic: Punto
    acierto: bool
    dpr: float = Field(1, gt=0)


class SesionCrear(BaseModel):
    tipo: Literal["libre", "practica", "comunicador"]


class Enunciado(BaseModel):
    texto: str = Field(max_length=2000)
    duracion_ms: float = Field(ge=0)
    selecciones: int = Field(0, ge=0)
    correcciones: int = Field(0, ge=0)


class PedirConexion(BaseModel):
    fuente: Fuente | None = None


class PedirCalibracion(BaseModel):
    tipo: Literal["centro"] = "centro"


class GestosFaciales(BaseModel):
    ojos: list[str]
    superior: list[str]
    inferior: list[str]


class GestosDisponibles(BaseModel):
    facial: GestosFaciales
    mental: list[str]


class PedirEntrenamiento(BaseModel):
    deteccion: Literal["mental", "facial"]
    accion: str = Field(min_length=1, max_length=30)


class EntrenamientoIniciado(BaseModel):
    id: str


class PedirVoz(BaseModel):
    texto: str = Field(min_length=1, max_length=2000)


class SimularGesto(BaseModel):
    gesto: str
    potencia: float | None = None


class SimularCabeza(BaseModel):
    yaw: float = Field(ge=-180, le=180)
    pitch: float = Field(ge=-90, le=90)


class SimularContacto(BaseModel):
    malo: bool


# --------------------------------------------------------------- eventos WS
class EvHola(BaseModel):
    version: str
    estado: Estado
    ajustes: Ajustes | None = None


class EvConexion(Conexion):
    codigo: CodigoError | None = None


class EvDispositivo(BaseModel):
    bateria_pct: int = Field(ge=0, le=100)
    senal: float
    contacto: dict[str, int]
    calidad_global: int = Field(ge=0, le=100)


class EvOrientacion(BaseModel):
    yaw: float
    pitch: float
    calibrado: bool


class EvGesto(BaseModel):
    gesto: str
    zona: Literal["ojos", "superior", "inferior", "mental"]
    potencia: float


class OrigenAccion(BaseModel):
    tipo: Literal["gesto", "mental", "dwell", "interfaz"]
    nombre: str


class EvAccion(BaseModel):
    accion: Accion
    origen: OrigenAccion
    modo: Modo
    ejecutada: bool
    motivo: Literal["pausado", "cooldown", "bajo_umbral"] | None = None


class EvEntrada(BaseModel):
    accion: Literal["seleccionar", "atras"]


class EvModo(BaseModel):
    modo: Modo
    pausado: bool
    motivo: Literal["usuario", "gesto_rescate", "ui_desconectada", "calibracion", "entrenamiento",
                    "conexion"]


class EvCalibracion(BaseModel):
    estado: Literal["en_curso", "completada", "fallida", "cancelada"]
    progreso: float = Field(ge=0, le=1)
    instruccion: str


class EvAjustes(BaseModel):
    perfil_id: str
    ajustes: Ajustes


class EvError(BaseModel):
    codigo: CodigoError
    mensaje: str
    recuperable: bool


class EvEntrenamiento(BaseModel):
    fase: Literal["iniciado", "exito", "fallo", "guardado", "rechazado"]
    deteccion: Literal["mental", "facial"]
    accion: str


EVENTOS: dict[str, type[BaseModel]] = {
    "hola": EvHola, "conexion": EvConexion, "dispositivo": EvDispositivo,
    "orientacion": EvOrientacion, "gesto": EvGesto, "accion": EvAccion, "entrada": EvEntrada,
    "modo": EvModo, "calibracion": EvCalibracion, "ajustes": EvAjustes, "error": EvError,
    "entrenamiento": EvEntrenamiento,
}


class Sobre(BaseModel):
    """Envoltorio de todo mensaje WebSocket (servidor → cliente)."""

    v: Literal[1] = 1
    tipo: str
    seq: int
    t: int  # ms desde epoch, hora del servidor
    datos: dict[str, Any]


SENSORES = ["AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", "P8", "T8", "FC6", "F4", "F8", "AF4"]

# Ejemplos compartidos: alimentan los mocks de la interfaz y se validan en los tests.
EJEMPLOS: dict[str, BaseModel] = {
    "hola": EvHola(version="0.1.0", estado=Estado(
        conexion=Conexion(estado="conectado", casco_id="EPOCX-SIMULADO"), modo="cursor",
        calibrado=True, perfil_activo_id="p-1"), ajustes=Ajustes()),
    "conexion": EvConexion(estado="conectado", casco_id="EPOCX-SIMULADO"),
    "dispositivo": EvDispositivo(bateria_pct=82, senal=1.0,
                                 contacto={s: 4 for s in SENSORES}, calidad_global=100),
    "orientacion": EvOrientacion(yaw=-3.5, pitch=1.2, calibrado=True),
    "gesto": EvGesto(gesto="clench", zona="inferior", potencia=0.82),
    "accion": EvAccion(accion="clic", origen=OrigenAccion(tipo="gesto", nombre="clench"),
                       modo="cursor", ejecutada=True),
    "entrada": EvEntrada(accion="seleccionar"),
    "modo": EvModo(modo="comunicador", pausado=False, motivo="usuario"),
    "calibracion": EvCalibracion(estado="en_curso", progreso=0.4,
                                 instruccion="Mira el punto central y no te muevas"),
    "ajustes": EvAjustes(perfil_id="p-1", ajustes=Ajustes()),
    "error": EvError(codigo="CASCO_DESCONECTADO", mensaje="El casco se desconectó",
                     recuperable=True),
    "entrenamiento": EvEntrenamiento(fase="exito", deteccion="mental", accion="push"),
}
