"""Voz de respaldo desde el motor (la interfaz usa Web Speech; esta sirve si está minimizada).

shortcut: pyttsx3 con un motor nuevo por frase en un hilo único (evita bloqueos de runAndWait
reutilizado); si hiciera falta interrumpir frases, pasar a SAPI directo con win32com.
"""

import logging
import queue
import threading
from typing import Protocol

log = logging.getLogger(__name__)


class Voz(Protocol):
    def hablar(self, texto: str, velocidad: int) -> None: ...
    def cerrar(self) -> None: ...


class VozSO:
    def __init__(self) -> None:
        self._cola: queue.Queue[tuple[str, int] | None] = queue.Queue()
        threading.Thread(target=self._bucle, name="voz", daemon=True).start()

    def hablar(self, texto: str, velocidad: int) -> None:
        self._cola.put((texto, velocidad))

    def _bucle(self) -> None:
        while (frase := self._cola.get()) is not None:
            try:
                import pyttsx3

                motor = pyttsx3.init()
                motor.setProperty("rate", frase[1])
                for v in motor.getProperty("voices"):
                    if "spanish" in v.name.lower() or "español" in v.name.lower():
                        motor.setProperty("voice", v.id)
                        break
                motor.say(frase[0])
                motor.runAndWait()
            except Exception:  # noqa: BLE001 — sin voz instalada el texto sigue en pantalla
                log.warning("No se pudo sintetizar la voz", exc_info=True)

    def cerrar(self) -> None:
        self._cola.put(None)


class VozFalsa:
    def __init__(self) -> None:
        self.frases: list[str] = []

    def hablar(self, texto: str, velocidad: int) -> None:
        self.frases.append(texto)

    def cerrar(self) -> None:
        return None
