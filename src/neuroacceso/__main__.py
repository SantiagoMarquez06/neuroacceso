"""NeuroAcceso — punto de entrada.

    python -m neuroacceso                      # aplicación completa con el casco real
    python -m neuroacceso --demo               # demo SIN casco (abre el simulador)
    python -m neuroacceso --modo cursor        # solo cursor, sin interfaz
    python -m neuroacceso --modo comunicador [--simular]
"""

from __future__ import annotations

import argparse
import logging
import queue
import socket
import subprocess
import sys
import time

from . import config
from .cortex_client import CortexClient, CortexError
from .gestos import DetectorGestos

log = logging.getLogger("neuroacceso")


def modo_cursor(url: str) -> None:
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
    cortex = CortexClient(config.CLIENT_ID, config.CLIENT_SECRET, url=url)
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


def modo_comunicador(url: str, simular: bool) -> None:
    from .comunicador import Comunicador

    eventos: queue.Queue = queue.Queue()
    cortex = None
    if not simular:
        gestos = DetectorGestos(
            config.MAPEO_GESTOS_COMUNICADOR, lambda accion, gesto: eventos.put(accion)
        )
        cortex = CortexClient(config.CLIENT_ID, config.CLIENT_SECRET, url=url)
        cortex.on("fac", gestos.procesar)
        cortex.iniciar(["fac", "dev"])

    Comunicador(None, eventos, simular=simular).ejecutar()
    if cortex:
        cortex.cerrar()


def _esperar_puerto(puerto: int, timeout: float = 10) -> bool:
    limite = time.time() + timeout
    while time.time() < limite:
        with socket.socket() as s:
            if s.connect_ex(("localhost", puerto)) == 0:
                return True
        time.sleep(0.2)
    return False


def modo_demo(mover_raton: bool) -> None:
    from .app import App
    from .simulador import PUERTO

    sim = subprocess.Popen([sys.executable, "-m", "neuroacceso.simulador",
                            "--puerto", str(PUERTO)])
    try:
        if not _esperar_puerto(PUERTO):
            sys.exit("El simulador no arrancó. ¿Instalaste las dependencias de demo? "
                     "pip install -e .[demo]")
        App(f"ws://localhost:{PUERTO}", "demo", "demo", mover_raton=mover_raton,
            etiqueta_fuente="MODO DEMO · casco simulado").ejecutar()
    finally:
        sim.terminate()
        try:
            sim.wait(5)
        except subprocess.TimeoutExpired:
            sim.kill()


def main() -> None:
    p = argparse.ArgumentParser(prog="neuroacceso", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--modo", choices=["app", "cursor", "comunicador"], default="app")
    p.add_argument("--demo", action="store_true",
                   help="usar el casco simulado (no hace falta el EPOC X ni credenciales)")
    p.add_argument("--simular", action="store_true",
                   help="comunicador sin casco: la barra espaciadora hace de gesto")
    p.add_argument("--sin-raton", action="store_true",
                   help="no mover el ratón real (solo visualización)")
    p.add_argument("--url", default=config.CORTEX_URL, help="URL del servicio Cortex")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    try:
        if args.demo:
            modo_demo(mover_raton=not args.sin_raton)
        elif args.modo == "app":
            from .app import App

            App(args.url, config.CLIENT_ID, config.CLIENT_SECRET,
                mover_raton=not args.sin_raton).ejecutar()
        elif args.modo == "cursor":
            modo_cursor(args.url)
        else:
            modo_comunicador(args.url, args.simular)
    except CortexError as e:
        sys.exit(f"Error: {e}")


if __name__ == "__main__":
    main()
