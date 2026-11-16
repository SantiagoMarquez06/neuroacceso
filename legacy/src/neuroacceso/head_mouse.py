"""Mueve el cursor según el movimiento de la cabeza (stream 'mot').

Soporta los dos formatos que puede entregar Cortex:
  * Cuaterniones Q0..Q3 (cascos nuevos) → se calcula yaw/pitch y se usa su variación.
  * Giroscopio GYROX/GYROY/GYROZ (cascos antiguos) → velocidad angular menos el sesgo.
"""

from __future__ import annotations

import math
from typing import Any

import pyautogui

from . import config

pyautogui.FAILSAFE = False  # el cursor puede llegar a las esquinas sin lanzar excepción
pyautogui.PAUSE = 0


def cuaternion_a_yaw_pitch(q0: float, q1: float, q2: float, q3: float) -> tuple[float, float]:
    """Convierte un cuaternión (w, x, y, z) a (yaw, pitch) en grados."""
    yaw = math.degrees(math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)))
    s = max(-1.0, min(1.0, 2 * (q0 * q2 - q3 * q1)))
    pitch = math.degrees(math.asin(s))
    return yaw, pitch


def _diferencia_angular(a: float, b: float) -> float:
    """a - b en el rango [-180, 180)."""
    return (a - b + 180) % 360 - 180


class HeadMouse:
    def __init__(self):
        self.activo = True
        self._calib: list[tuple[float, float]] = []
        self._sesgo = (0.0, 0.0)
        self._anterior: tuple[float, float] | None = None
        self._vel = (0.0, 0.0)

    def alternar_pausa(self) -> bool:
        self.activo = not self.activo
        self._anterior = None
        return self.activo

    @property
    def calibrado(self) -> bool:
        return len(self._calib) >= config.MUESTRAS_CALIBRACION

    def procesar(self, m: dict[str, Any], _t: float = 0.0) -> None:
        if "Q0" in m:
            dx, dy = self._delta_cuaternion(m)
        elif "GYROX" in m:
            dx, dy = self._delta_giroscopio(m)
        else:
            return
        if dx is None or not self.activo:
            return

        if abs(dx) < config.ZONA_MUERTA:
            dx = 0.0
        if abs(dy) < config.ZONA_MUERTA:
            dy = 0.0

        # Suavizado exponencial para reducir temblor.
        a = config.SUAVIZADO
        self._vel = (a * self._vel[0] + (1 - a) * dx, a * self._vel[1] + (1 - a) * dy)

        px = self._vel[0] * config.GANANCIA_X * (-1 if config.INVERTIR_X else 1)
        py = self._vel[1] * config.GANANCIA_Y * (-1 if config.INVERTIR_Y else 1)
        if px or py:
            pyautogui.moveRel(round(px), round(py))

    def _delta_cuaternion(self, m):
        yaw, pitch = cuaternion_a_yaw_pitch(m["Q0"], m["Q1"], m["Q2"], m["Q3"])
        if not self.calibrado:
            self._calib.append((yaw, pitch))
            self._anterior = (yaw, pitch)
            return None, None
        if self._anterior is None:
            self._anterior = (yaw, pitch)
            return None, None
        # Girar a la derecha disminuye el yaw → se invierte para que el cursor vaya a la derecha.
        dx = -_diferencia_angular(yaw, self._anterior[0])
        dy = -(pitch - self._anterior[1])
        self._anterior = (yaw, pitch)
        return dx, dy

    def _delta_giroscopio(self, m):
        gx, gy = float(m["GYROX"]), float(m["GYROY"])
        if not self.calibrado:
            self._calib.append((gx, gy))
            if self.calibrado:
                n = len(self._calib)
                self._sesgo = (sum(c[0] for c in self._calib) / n, sum(c[1] for c in self._calib) / n)
            return None, None
        # Escalado a grados por muestra aproximado; ajustar GANANCIA_* en config.
        return (gx - self._sesgo[0]) / 100.0, (gy - self._sesgo[1]) / 100.0
