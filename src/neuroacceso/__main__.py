"""Punto de entrada: python -m neuroacceso --modo cursor|comunicador [--simular]"""

from __future__ import annotations

import argparse
import logging
import queue
import sys
import time

from . import config
from .cortex_client import CortexClient, CortexError
from .gestos import DetectorGestos

log = logging.getLogger("neuroacceso")


def modo_cursor() -> None:
    import pyautogui

    from .head_mouse import HeadMouse

    mouse = HeadMouse()

    def accion(nombre: str, gesto: str) -> None:
        log.info("Gesto '%s' → %s", gesto, nombre)
        if nombre == "pausar":
            log.info("Cursor %s", "activo" if mouse.alternar_pausa() else "en pausa")
        elif not mouse.activo:
            return
        elif nombre == "clic":
            pyautogui.click()
        elif nombre == "clic_derecho":
            pyautogui.rightClick()
        elif nombre == "doble_clic":
            pyautogui.doubleClick()

    gestos = DetectorGestos(config.MAPEO_GESTOS_CURSOR, accion)
    cortex = CortexClient(config.CLIENT_ID, config.CLIENT_SECRET)
    cortex.on("mot", mouse.procesar)
    cortex.on("fac", gestos.procesar)
    cortex.iniciar(["mot", "fac", "dev"])

    print("Mira al frente sin moverte ~2 segundos para calibrar…")
    print("Ctrl+C para salir.")
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        cortex.cerrar()


def modo_comunicador(simular: bool) -> None:
    from .comunicador import Comunicador

    eventos: queue.Queue = queue.Queue()
    cortex = None
    if not simular:
        gestos = DetectorGestos(
            config.MAPEO_GESTOS_COMUNICADOR, lambda accion, gesto: eventos.put(accion)
        )
        cortex = CortexClient(config.CLIENT_ID, config.CLIENT_SECRET)
        cortex.on("fac", gestos.procesar)
        cortex.iniciar(["fac", "dev"])

    Comunicador(eventos, simular=simular).ejecutar()
    if cortex:
        cortex.cerrar()


def main() -> None:
    p = argparse.ArgumentParser(prog="neuroacceso", description=__doc__)
    p.add_argument("--modo", choices=["cursor", "comunicador"], default="cursor")
    p.add_argument("--simular", action="store_true",
                   help="comunicador sin casco: la barra espaciadora hace de gesto")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    try:
        if args.modo == "cursor":
            if args.simular:
                sys.exit("El modo cursor necesita el casco (--simular solo aplica al comunicador).")
            modo_cursor()
        else:
            modo_comunicador(args.simular)
    except CortexError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()
