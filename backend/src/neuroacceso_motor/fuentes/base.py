"""Interfaz común de las fuentes de datos (Cortex, simulador, reproducción de grabaciones)."""

import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Literal, Protocol

from ..contrato import CodigoError


def _ahora() -> float:
    return time.perf_counter()


@dataclass(frozen=True)
class Movimiento:
    t: float               # s, marca de tiempo de la fuente
    q: tuple[float, float, float, float] | None = None   # cuaternión (w, x, y, z), cascos nuevos
    giro: tuple[float, float, float] | None = None       # giroscopio, cascos antiguos
    rx: float = field(default_factory=_ahora, compare=False)  # recepción local, para latencia


@dataclass(frozen=True)
class Facial:
    t: float
    ojos: str = "neutral"          # eyeAct: blink, winkL, winkR, lookL, lookR…
    superior: str = "neutral"      # uAct: surprise, frown…
    potencia_superior: float = 0.0
    inferior: str = "neutral"      # lAct: clench, smile, laugh…
    potencia_inferior: float = 0.0
    rx: float = field(default_factory=_ahora, compare=False)


@dataclass(frozen=True)
class Dispositivo:
    t: float
    bateria_pct: int
    senal: float
    contacto: dict[str, int]       # sensor → 0..4
    calidad_global: int            # 0..100
    rx: float = field(default_factory=_ahora, compare=False)


@dataclass(frozen=True)
class Mental:
    t: float
    accion: str                    # neutral, push…
    potencia: float
    rx: float = field(default_factory=_ahora, compare=False)


@dataclass(frozen=True)
class Sistema:
    """Evento del entrenamiento de Cortex (stream `sys`), p. ej. MC_Succeeded."""

    t: float
    evento: str
    rx: float = field(default_factory=_ahora, compare=False)


Muestra = Movimiento | Facial | Dispositivo | Mental | Sistema
Deteccion = Literal["mentalCommand", "facialExpression"]
EstadoEntreno = Literal["start", "accept", "reject"]


class FuenteError(Exception):
    """Error de la fuente con su código del contrato."""

    def __init__(self, codigo: CodigoError, mensaje: str):
        super().__init__(mensaje)
        self.codigo: CodigoError = codigo
        self.mensaje = mensaje


class Fuente(Protocol):
    """Una fuente se abre, entrega muestras en orden y se cierra."""

    async def abrir(self) -> str:
        """Conecta y devuelve el identificador del casco. Lanza FuenteError."""
        ...

    def muestras(self) -> AsyncIterator[Muestra]:
        """Muestras hasta que la fuente termina (FuenteError si se pierde la conexión)."""
        ...

    async def cargar_perfil(self, nombre: str) -> None:
        """Carga (o crea) el perfil de entrenamiento del fabricante."""
        ...

    async def entrenar(self, deteccion: Deteccion, accion: str, estado: EstadoEntreno) -> None: ...

    async def cerrar(self) -> None: ...
