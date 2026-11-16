"""Casco EPOC X simulado dentro del proceso (modo --demo y pruebas).

Portado de legacy/src/neuroacceso/simulador.py (EstadoCasco). Se controla con
/api/v1/dev/simular/* o directamente con disparar(), cabeza() y contacto().
"""

import asyncio
import math
import random
import time
from collections import deque
from collections.abc import AsyncIterator

from ..contrato import SENSORES
from .base import (
    Deteccion,
    Dispositivo,
    EstadoEntreno,
    Facial,
    Mental,
    Movimiento,
    Muestra,
    Sistema,
)

HZ_MOV = 32
# gesto → (zona, duración en s)
GESTOS = {
    "clench": ("inferior", 0.4), "smile": ("inferior", 0.4), "laugh": ("inferior", 0.4),
    "smirkLeft": ("inferior", 0.4), "smirkRight": ("inferior", 0.4),
    "surprise": ("superior", 0.4), "frown": ("superior", 0.4),
    "blink": ("ojos", 0.25), "winkL": ("ojos", 0.3), "winkR": ("ojos", 0.3),
    "lookL": ("ojos", 0.3), "lookR": ("ojos", 0.3),
    "push": ("mental", 0.6),
}
CASCO = "EPOCX-SIMULADO"


def yaw_pitch_a_cuaternion(yaw: float, pitch: float) -> tuple[float, float, float, float]:
    """Rotación yaw (eje Z) y luego pitch (eje Y), en grados → (w, x, y, z)."""
    y, p = math.radians(yaw) / 2, math.radians(pitch) / 2
    return (math.cos(y) * math.cos(p), -math.sin(y) * math.sin(p),
            math.cos(y) * math.sin(p), math.sin(y) * math.cos(p))


class Simulador:
    def __init__(self, hz: int = HZ_MOV):
        self.hz = hz
        self.yaw = 0.0
        self.pitch = 0.0
        self.mal_contacto = False
        self.bateria = 87.0
        self._gesto: str | None = None
        self._hasta = 0.0
        self._sistema: deque[str] = deque()
        self._abierto = False

    # ------------------------------------------------------------- control
    def disparar(self, gesto: str) -> None:
        if gesto not in GESTOS:
            raise ValueError(f"gesto desconocido: {gesto}")
        self._gesto, self._hasta = gesto, time.monotonic() + GESTOS[gesto][1]

    def cabeza(self, yaw: float, pitch: float) -> None:
        self.yaw, self.pitch = yaw, max(-60.0, min(60.0, pitch))

    def contacto(self, malo: bool) -> None:
        self.mal_contacto = malo

    # -------------------------------------------------------------- Fuente
    async def abrir(self) -> str:
        self._abierto = True
        return CASCO

    async def cerrar(self) -> None:
        self._abierto = False

    async def cargar_perfil(self, nombre: str) -> None:
        return None

    async def entrenar(self, deteccion: Deteccion, accion: str, estado: EstadoEntreno) -> None:
        pre = "MC" if deteccion == "mentalCommand" else "FE"
        if estado == "start":
            self._sistema.append(f"{pre}_Started")
            # El casco real tarda ~8 s; aquí 1 s para que la demo sea ágil.
            asyncio.get_running_loop().call_later(1.0, self._sistema.append, f"{pre}_Succeeded")
        else:
            self._sistema.append(f"{pre}_Completed" if estado == "accept" else f"{pre}_Rejected")

    async def muestras(self) -> AsyncIterator[Muestra]:
        n = 0
        while self._abierto:
            await asyncio.sleep(1 / self.hz)
            n += 1
            t = time.time()
            ruido = random.uniform(-0.03, 0.03)  # micro-temblor de la cabeza
            yield Movimiento(t=t, q=yaw_pitch_a_cuaternion(self.yaw + ruido, self.pitch + ruido))
            if n % 4 == 0:
                yield self._facial(t)
                yield self._mental(t)
            if n % 16 == 0:
                yield self._dispositivo(t)
            while self._sistema:
                yield Sistema(t=t, evento=self._sistema.popleft())

    # ------------------------------------------------------------ muestras
    def _activo(self, zona: str) -> str | None:
        g = self._gesto
        if g and time.monotonic() < self._hasta and GESTOS[g][0] == zona:
            return g
        return None

    def _facial(self, t: float) -> Facial:
        sup, inf = self._activo("superior"), self._activo("inferior")
        return Facial(t=t, ojos=self._activo("ojos") or "neutral",
                      superior=sup or "neutral", potencia_superior=0.85 if sup else 0.0,
                      inferior=inf or "neutral", potencia_inferior=0.85 if inf else 0.0)

    def _mental(self, t: float) -> Mental:
        m = self._activo("mental")
        return Mental(t=t, accion=m or "neutral", potencia=0.8 if m else 0.0)

    def _dispositivo(self, t: float) -> Dispositivo:
        malos = {"T7", "P7", "O1", "FC6"} if self.mal_contacto else set()
        contacto = {s: (1 if s in malos else 4) for s in SENSORES}
        self.bateria = max(5.0, self.bateria - 0.001)
        return Dispositivo(t=t, bateria_pct=round(self.bateria), senal=0.8 if malos else 1.0,
                           contacto=contacto,
                           calidad_global=round(sum(contacto.values()) / (4 * len(contacto)) * 100))
