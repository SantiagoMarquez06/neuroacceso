"""Hub de eventos en tiempo real hacia los clientes WebSocket."""

import asyncio
import time
from typing import Any

from pydantic import BaseModel

from .contrato import Sobre

DESCARTABLES = {"orientacion"}  # alta frecuencia: si un cliente va lento, se pierden sin daño


class Hub:
    def __init__(self, capacidad: int = 256):
        self.capacidad = capacidad
        self._clientes: set[asyncio.Queue[tuple[str, dict[str, Any]]]] = set()

    @property
    def n_clientes(self) -> int:
        return len(self._clientes)

    def suscribir(self) -> asyncio.Queue[tuple[str, dict[str, Any]]]:
        q: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue(self.capacidad)
        self._clientes.add(q)
        return q

    def quitar(self, q: asyncio.Queue[tuple[str, dict[str, Any]]]) -> None:
        self._clientes.discard(q)

    def publicar(self, tipo: str, datos: BaseModel) -> None:
        payload = datos.model_dump(mode="json")
        for q in self._clientes:
            if q.full():
                if tipo in DESCARTABLES:
                    continue
                q.get_nowait()  # cliente lento: se descarta el evento más viejo
            q.put_nowait((tipo, payload))


def sobre(tipo: str, datos: dict[str, Any], seq: int) -> dict[str, Any]:
    return Sobre(tipo=tipo, seq=seq, t=int(time.time() * 1000), datos=datos).model_dump()
