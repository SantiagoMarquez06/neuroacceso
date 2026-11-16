"""Interfaz común de las fuentes de datos (Cortex, simulador, reproducción de grabaciones)."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Movimiento:
    t: float               # s, marca de tiempo de la fuente
    q: tuple[float, float, float, float] | None = None   # cuaternión (w, x, y, z), cascos nuevos
    giro: tuple[float, float, float] | None = None       # giroscopio, cascos antiguos


@dataclass(frozen=True)
class Facial:
    t: float
    ojos: str = "neutral"          # eyeAct: blink, winkL, winkR, lookL, lookR…
    superior: str = "neutral"      # uAct: surprise, frown…
    potencia_superior: float = 0.0
    inferior: str = "neutral"      # lAct: clench, smile, laugh…
    potencia_inferior: float = 0.0


@dataclass(frozen=True)
class Dispositivo:
    t: float
    bateria_pct: int
    senal: float
    contacto: dict[str, int]       # sensor → 0..4
    calidad_global: int            # 0..100


@dataclass(frozen=True)
class Mental:
    t: float
    accion: str                    # neutral, push…
    potencia: float


Muestra = Movimiento | Facial | Dispositivo | Mental


class Fuente(Protocol):
    """Una fuente se abre, entrega muestras en orden y se cierra."""

    async def abrir(self) -> str:
        """Conecta y devuelve el identificador del casco."""
        ...

    def muestras(self) -> AsyncIterator[Muestra]: ...

    async def cerrar(self) -> None: ...
