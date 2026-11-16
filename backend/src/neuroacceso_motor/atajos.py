"""Atajos de teclado globales de emergencia (para el acompañante).

    Ctrl+Alt+P  pausar / reanudar el control del ratón
    Ctrl+Alt+C  recalibrar el centro
"""

import asyncio
import logging
from typing import Any

from .motor import ModoInvalido, Motor

log = logging.getLogger(__name__)


def _pausar(motor: Motor) -> None:
    try:
        motor.cambiar_modo("cursor" if motor.estado.modo == "pausa" else "pausa", "usuario")
    except ModoInvalido:
        pass


def _calibrar(motor: Motor) -> None:
    try:
        motor.iniciar_calibracion()
    except ModoInvalido:
        pass


def iniciar(motor: Motor, loop: asyncio.AbstractEventLoop) -> Any:
    """Devuelve el listener (o None si pynput no está disponible)."""
    try:
        from pynput import keyboard
    except Exception:  # noqa: BLE001
        log.warning("pynput no disponible: sin atajos de emergencia")
        return None
    atajos = keyboard.GlobalHotKeys({
        "<ctrl>+<alt>+p": lambda: loop.call_soon_threadsafe(_pausar, motor),
        "<ctrl>+<alt>+c": lambda: loop.call_soon_threadsafe(_calibrar, motor),
    })
    atajos.daemon = True
    atajos.start()
    return atajos
