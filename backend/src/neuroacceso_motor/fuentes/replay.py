"""Grabación de sesiones en JSONL y reproducción (para pruebas con datos reales).

Formato: una muestra por línea, {"tipo": "Movimiento", "t": ..., ...campos}.
"""

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import asdict
from pathlib import Path
from typing import IO

from .base import (
    Deteccion,
    Dispositivo,
    EstadoEntreno,
    Facial,
    Fuente,
    FuenteError,
    Mental,
    Movimiento,
    Muestra,
    Sistema,
)

TIPOS: dict[str, type] = {
    c.__name__: c for c in (Movimiento, Facial, Dispositivo, Mental, Sistema)}


def a_json(m: Muestra) -> str:
    d = asdict(m)
    d.pop("rx")
    return json.dumps({"tipo": type(m).__name__, **d}, ensure_ascii=False)


def de_json(linea: str) -> Muestra:
    d = json.loads(linea)
    cls = TIPOS[d.pop("tipo")]
    for k in ("q", "giro"):
        if d.get(k) is not None:
            d[k] = tuple(d[k])
    return cls(**d)  # type: ignore[no-any-return]


class Replay:
    """Reproduce una grabación. velocidad=1 en tiempo real; 0 = lo más rápido posible."""

    def __init__(self, archivo: str | Path, velocidad: float = 1.0):
        self.archivo = Path(archivo)
        self.velocidad = velocidad

    async def abrir(self) -> str:
        if not self.archivo.is_file():
            raise FuenteError("SIN_CASCO", f"No existe la grabación {self.archivo}")
        return f"REPLAY:{self.archivo.name}"

    async def muestras(self) -> AsyncIterator[Muestra]:
        previo: float | None = None
        with self.archivo.open(encoding="utf-8") as f:
            for linea in f:
                if not linea.strip():
                    continue
                t = float(json.loads(linea)["t"])
                if self.velocidad and previo is not None and t > previo:
                    await asyncio.sleep((t - previo) / self.velocidad)
                else:
                    await asyncio.sleep(0)
                previo = t
                yield de_json(linea)  # se crea tras la espera: rx mide la latencia real

    async def cargar_perfil(self, nombre: str) -> None:
        return None

    async def entrenar(self, deteccion: Deteccion, accion: str, estado: EstadoEntreno) -> None:
        return None

    async def cerrar(self) -> None:
        return None


class Grabador:
    """Envuelve otra fuente y guarda cada muestra en un archivo JSONL."""

    def __init__(self, fuente: Fuente, archivo: str | Path):
        self.fuente = fuente
        self.archivo = Path(archivo)
        self._f: IO[str] | None = None

    async def abrir(self) -> str:
        casco = await self.fuente.abrir()
        self.archivo.parent.mkdir(parents=True, exist_ok=True)
        self._f = self.archivo.open("a", encoding="utf-8")
        return casco

    async def muestras(self) -> AsyncIterator[Muestra]:
        async for m in self.fuente.muestras():
            if self._f:
                self._f.write(a_json(m) + "\n")
            yield m

    async def cargar_perfil(self, nombre: str) -> None:
        await self.fuente.cargar_perfil(nombre)

    async def entrenar(self, deteccion: Deteccion, accion: str, estado: EstadoEntreno) -> None:
        await self.fuente.entrenar(deteccion, accion, estado)

    async def cerrar(self) -> None:
        if self._f:
            self._f.close()
            self._f = None
        await self.fuente.cerrar()
