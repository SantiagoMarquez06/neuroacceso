"""Aplicación de escritorio: el motor en un hilo + ventana principal y barra flotante (pywebview).

El token viaja en el fragmento de la URL (#token=…): no se envía al servidor ni queda en logs, y
solo lo conocen estas ventanas. La interfaz lo lee de location.hash.
"""

import threading
import time
import urllib.request

import uvicorn

from .main import Config, crear_app


def url_ventana(config: Config, ruta: str = "") -> str:
    return f"http://127.0.0.1:{config.puerto}/{ruta}#token={config.token}"


def _esperar_servidor(config: Config, segundos: float = 15) -> None:
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{config.puerto}/", timeout=1)  # noqa: S310
            return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError("El motor no arrancó")


def ejecutar(config: Config) -> None:
    import webview  # pywebview: dependencia del grupo "escritorio"

    servidor = uvicorn.Server(uvicorn.Config(crear_app(config), host="127.0.0.1",
                                             port=config.puerto, log_level="warning"))
    hilo = threading.Thread(target=servidor.run, name="motor", daemon=True)
    hilo.start()
    _esperar_servidor(config)

    webview.create_window("NeuroAcceso", url_ventana(config), width=1180, height=760,
                          min_size=(960, 600))
    webview.create_window("NeuroAcceso — barra", url_ventana(config, "barra"), width=640,
                          height=72, on_top=True, resizable=False, x=40, y=8)
    webview.start()  # bloquea hasta cerrar todas las ventanas
    servidor.should_exit = True
    hilo.join(timeout=5)
