"""Actuadores del sistema operativo: mueven el ratón y hacen clics desde un hilo propio.

pyautogui bloquea; si corriera en el bucle asyncio, retrasaría el procesamiento. Un único hilo
con cola mantiene el orden de los movimientos y mide la latencia desde la recepción.
"""

import queue
import statistics
import threading
import time
from collections import deque
from typing import Literal, Protocol

Boton = Literal["clic", "clic_derecho", "doble_clic"]


class Raton(Protocol):
    def mover(self, dx: float, dy: float, rx: float) -> None: ...
    def clic(self, boton: Boton, rx: float) -> None: ...
    def latencia_ms(self) -> tuple[float, float]: ...
    def cerrar(self) -> None: ...


class _Medidor:
    def __init__(self) -> None:
        self._ms: deque[float] = deque(maxlen=500)

    def registrar(self, rx: float) -> None:
        self._ms.append((time.perf_counter() - rx) * 1000)

    def latencia_ms(self) -> tuple[float, float]:
        if len(self._ms) < 2:
            return (self._ms[0], self._ms[0]) if self._ms else (0.0, 0.0)
        q = statistics.quantiles(self._ms, n=20)
        return statistics.median(self._ms), q[18]  # p50, p95


class RatonSO(_Medidor):
    def __init__(self) -> None:
        super().__init__()
        try:  # coordenadas en píxeles físicos aunque Windows escale la pantalla
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(2)  # type: ignore[attr-defined]
        except (AttributeError, OSError):
            pass
        import pyautogui

        pyautogui.FAILSAFE = False  # el cursor puede llegar a las esquinas
        pyautogui.PAUSE = 0
        self._pg = pyautogui
        self._cola: queue.Queue[tuple[str, float, float, float] | None] = queue.Queue()
        self._hilo = threading.Thread(target=self._bucle, name="actuador-raton", daemon=True)
        self._hilo.start()

    def mover(self, dx: float, dy: float, rx: float) -> None:
        self._cola.put(("mover", dx, dy, rx))

    def clic(self, boton: Boton, rx: float) -> None:
        self._cola.put((boton, 0, 0, rx))

    def _bucle(self) -> None:
        while (orden := self._cola.get()) is not None:
            tipo, dx, dy, rx = orden
            try:
                if tipo == "mover":
                    self._pg.moveRel(round(dx), round(dy))
                elif tipo == "clic":
                    self._pg.click()
                elif tipo == "clic_derecho":
                    self._pg.rightClick()
                elif tipo == "doble_clic":
                    self._pg.doubleClick()
                self.registrar(rx)
            except Exception:  # noqa: BLE001 — una ventana elevada (UAC) rechaza la entrada
                pass

    def cerrar(self) -> None:
        self._cola.put(None)


class RatonFalso(_Medidor):
    """No toca el sistema: registra las órdenes (pruebas y --sin-raton)."""

    def __init__(self) -> None:
        super().__init__()
        self.ordenes: list[tuple[str, float, float]] = []

    def mover(self, dx: float, dy: float, rx: float) -> None:
        self.ordenes.append(("mover", dx, dy))
        self.registrar(rx)

    def clic(self, boton: Boton, rx: float) -> None:
        self.ordenes.append((boton, 0, 0))
        self.registrar(rx)

    def cerrar(self) -> None:
        return None
