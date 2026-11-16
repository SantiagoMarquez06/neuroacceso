import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any

import pytest

from neuroacceso_motor.actuadores import RatonFalso
from neuroacceso_motor.datos import Datos
from neuroacceso_motor.eventos import Hub
from neuroacceso_motor.fuentes.base import Facial, Movimiento, Muestra
from neuroacceso_motor.fuentes.simulador import yaw_pitch_a_cuaternion
from neuroacceso_motor.motor import Motor
from neuroacceso_motor.procesamiento import MUESTRAS_CALIBRACION


class FuenteLista:
    """Fuente de prueba: entrega las muestras dadas y luego espera (o termina)."""

    def __init__(self, muestras: list[Muestra] | None = None, terminar: bool = False):
        self._muestras = muestras or []
        self.terminar = terminar
        self.entrenos: list[tuple[str, str, str]] = []
        self.perfiles: list[str] = []

    async def abrir(self) -> str:
        return "CASCO-PRUEBA"

    async def muestras(self) -> AsyncIterator[Muestra]:
        for m in self._muestras:
            yield m
        if not self.terminar:
            await asyncio.Event().wait()

    async def cargar_perfil(self, nombre: str) -> None:
        self.perfiles.append(nombre)

    async def entrenar(self, deteccion: str, accion: str, estado: str) -> None:
        self.entrenos.append((deteccion, accion, estado))

    async def cerrar(self) -> None:
        return None


def mov(yaw: float = 0, pitch: float = 0) -> Movimiento:
    return Movimiento(t=time.time(), q=yaw_pitch_a_cuaternion(yaw, pitch))


def cara(**kw: Any) -> Facial:
    return Facial(t=time.time(), **kw)


class Banco:
    """Motor con ratón falso y base en memoria; `eventos()` vacía lo publicado."""

    def __init__(self) -> None:
        self.raton = RatonFalso()
        self.hub = Hub()
        self.fuente = FuenteLista()
        self.motor = Motor(lambda: self.fuente, self.raton, Datos(":memory:"), self.hub)
        self._cola = self.hub.suscribir()

    def eventos(self, tipo: str | None = None) -> list[dict[str, Any]]:
        salida = []
        while not self._cola.empty():
            t, d = self._cola.get_nowait()
            if tipo is None or t == tipo:
                salida.append({"tipo": t, **d})
        return salida

    def conectar_y_calibrar(self) -> None:
        """Simula una conexión: fuente lista + calibración completa mirando al frente."""
        self.motor.fuente = self.fuente
        self.motor.iniciar_calibracion()
        for _ in range(MUESTRAS_CALIBRACION):
            self.motor.procesar(mov())
        self.motor.procesar(mov())  # cierra la calibración
        self.motor._ultima_accion = 0  # sin antirrebote pendiente


@pytest.fixture
def banco() -> Banco:
    return Banco()
