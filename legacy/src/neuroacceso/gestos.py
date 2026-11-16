"""Convierte muestras del stream 'fac' en acciones, con umbral y anti-rebote."""

from __future__ import annotations

import time
from typing import Any, Callable

from . import config


class DetectorGestos:
    def __init__(
        self,
        mapeo: dict[str, str],
        al_detectar: Callable[[str, str], None],
        umbral: float = config.UMBRAL_POTENCIA,
        cooldown_s: float = config.COOLDOWN_S,
    ):
        self.mapeo = mapeo
        self.al_detectar = al_detectar  # recibe (accion, gesto)
        self.umbral = umbral
        self.cooldown_s = cooldown_s
        self._ultima = 0.0

    def procesar(self, muestra: dict[str, Any], _t: float = 0.0) -> None:
        gesto = self._gesto_activo(muestra)
        if gesto is None or gesto not in self.mapeo:
            return
        ahora = time.monotonic()
        if ahora - self._ultima < self.cooldown_s:
            return
        self._ultima = ahora
        self.al_detectar(self.mapeo[gesto], gesto)

    def _gesto_activo(self, m: dict[str, Any]) -> str | None:
        # Ojos: no tienen intensidad; cualquier valor distinto de neutral cuenta.
        ojo = m.get("eyeAct")
        if ojo and ojo != "neutral" and ojo in self.mapeo:
            return ojo
        # Cara inferior y superior: exigir intensidad mínima.
        for accion, potencia in (("lAct", "lPow"), ("uAct", "uPow")):
            g = m.get(accion)
            if g and g != "neutral" and (m.get(potencia) or 0) >= self.umbral:
                return g
        return None
