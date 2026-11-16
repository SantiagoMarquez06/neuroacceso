"""Procesamiento en tiempo real: cursor por la cabeza, gestos y clic por permanencia.

Portado de legacy/src/neuroacceso/head_mouse.py y gestos.py, leyendo los ajustes del perfil.
"""

import math
from dataclasses import dataclass

from .contrato import AjustesCursor, AjustesDwell
from .fuentes.base import Facial, Mental, Movimiento

MUESTRAS_CALIBRACION = 64      # ~2 s a 32 Hz
MAX_DESVIO_CALIBRACION = 2.0   # grados: si la cabeza se mueve más, la calibración reinicia


def yaw_pitch(q: tuple[float, float, float, float]) -> tuple[float, float]:
    """Cuaternión (w, x, y, z) → (yaw, pitch) en grados."""
    q0, q1, q2, q3 = q
    yaw = math.degrees(math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2 * q2 + q3 * q3)))
    pitch = math.degrees(math.asin(max(-1.0, min(1.0, 2 * (q0 * q2 - q3 * q1)))))
    return yaw, pitch


def _dif_angular(a: float, b: float) -> float:
    return (a - b + 180) % 360 - 180


class Cursor:
    """Convierte el movimiento de la cabeza en desplazamiento del cursor (px)."""

    def __init__(self, ajustes: AjustesCursor):
        self.ajustes = ajustes
        self.centro: tuple[float, float] | None = None   # (yaw, pitch) o sesgo del giroscopio
        self.orientacion = (0.0, 0.0)                    # respecto al centro, en grados
        self._calib: list[tuple[float, float]] | None = None
        self.inestable = False
        self._anterior: tuple[float, float] | None = None
        self._vel = (0.0, 0.0)

    # ------------------------------------------------------------ calibración
    def calibrar(self) -> None:
        """Empieza a tomar el centro; el anterior sigue vigente hasta terminar."""
        self._calib = []
        self.inestable = False

    def cancelar(self) -> None:
        self._calib = None

    @property
    def calibrando(self) -> bool:
        return self._calib is not None

    @property
    def progreso(self) -> float:
        return 0.0 if self._calib is None else len(self._calib) / MUESTRAS_CALIBRACION

    def _calibrar_con(self, v: tuple[float, float]) -> None:
        assert self._calib is not None
        if self._calib and max(abs(_dif_angular(v[0], self._calib[0][0])),
                               abs(v[1] - self._calib[0][1])) > MAX_DESVIO_CALIBRACION:
            self._calib, self.inestable = [], True  # se movió: empezar de nuevo
        self._calib.append(v)
        if len(self._calib) >= MUESTRAS_CALIBRACION:
            n = len(self._calib)
            self.centro = (sum(c[0] for c in self._calib) / n, sum(c[1] for c in self._calib) / n)
            self._calib, self._anterior, self._vel = None, None, (0.0, 0.0)

    # ---------------------------------------------------------------- muestra
    def procesar(self, m: Movimiento) -> tuple[float, float] | None:
        """Devuelve (dx, dy) en px, o None si no hay movimiento que aplicar."""
        if m.q is not None:
            v = yaw_pitch(m.q)
        elif m.giro is not None:
            v = (m.giro[0], m.giro[1])
        else:
            return None
        if self._calib is not None:
            self._calibrar_con(v)
            return None
        if self.centro is None:
            return None
        if m.q is not None:
            self.orientacion = (_dif_angular(v[0], self.centro[0]), v[1] - self.centro[1])
            if self._anterior is None:
                self._anterior = v
                return None
            # Girar a la derecha disminuye el yaw → se invierte para mover el cursor a la derecha.
            dx, dy = -_dif_angular(v[0], self._anterior[0]), -(v[1] - self._anterior[1])
            self._anterior = v
        else:
            # Giroscopio: velocidad angular menos el sesgo (centro); escala aproximada a grados.
            dx, dy = (v[0] - self.centro[0]) / 100, (v[1] - self.centro[1]) / 100
        a = self.ajustes
        dx = 0.0 if abs(dx) < a.zona_muerta else dx
        dy = 0.0 if abs(dy) < a.zona_muerta else dy
        s = a.suavizado
        self._vel = (s * self._vel[0] + (1 - s) * dx, s * self._vel[1] + (1 - s) * dy)
        px = self._vel[0] * a.ganancia_x * (-1 if a.invertir_x else 1)
        py = self._vel[1] * a.ganancia_y * (-1 if a.invertir_y else 1)
        return (px, py) if round(px) or round(py) else None


@dataclass(frozen=True)
class Gesto:
    gesto: str
    zona: str          # ojos | superior | inferior | mental
    potencia: float


def detectar(m: Facial | Mental) -> Gesto | None:
    """Gesto crudo (sin umbral): para retroalimentación y para decidir acciones."""
    if isinstance(m, Mental):
        return Gesto(m.accion, "mental", m.potencia) if m.accion != "neutral" else None
    if m.ojos != "neutral":
        return Gesto(m.ojos, "ojos", 1.0)  # los ojos no tienen intensidad
    if m.inferior != "neutral":
        return Gesto(m.inferior, "inferior", m.potencia_inferior)
    if m.superior != "neutral":
        return Gesto(m.superior, "superior", m.potencia_superior)
    return None


class Permanencia:
    """Clic por permanencia: el cursor quieto `ms` dentro de `radio_px` hace un clic."""

    def __init__(self, ajustes: AjustesDwell):
        self.ajustes = ajustes
        self._acumulado = (0.0, 0.0)
        self._desde: float | None = None
        self._armado = False   # tras un clic hay que moverse para poder hacer otro

    def actualizar(self, dx: float, dy: float, ahora: float) -> bool:
        ax, ay = self._acumulado[0] + dx, self._acumulado[1] + dy
        if math.hypot(ax, ay) > self.ajustes.radio_px:
            self._acumulado, self._desde, self._armado = (0.0, 0.0), ahora, True
            return False
        self._acumulado = (ax, ay)
        if self._desde is None:
            self._desde = ahora
        if self._armado and (ahora - self._desde) * 1000 >= self.ajustes.ms:
            self._armado = False
            return True
        return False
