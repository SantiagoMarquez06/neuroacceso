"""Punto de entrada.

    python -m neuroacceso_motor                    # casco real (EMOTIV Launcher abierto)
    python -m neuroacceso_motor --demo             # casco simulado
    python -m neuroacceso_motor --replay ses.jsonl # reproducir una grabación
    python -m neuroacceso_motor --escritorio       # ventana de la aplicación + barra flotante
"""

import argparse
import os
import sys
from pathlib import Path

import uvicorn

from .main import Config, crear_app

RAIZ = Path(__file__).resolve().parents[3]  # raíz del repositorio en desarrollo


def _cargar_env() -> None:
    """Lee EMOTIV_* de un .env (cwd o raíz del repo) sin pisar variables ya definidas."""
    # cwd, junto al ejecutable (versión empaquetada) y raíz del repo (desarrollo)
    for ruta in (Path.cwd() / ".env", Path(sys.executable).parent / ".env", RAIZ / ".env"):
        if ruta.is_file():
            for linea in ruta.read_text(encoding="utf-8").splitlines():
                clave, sep, valor = linea.partition("=")
                if sep and not clave.strip().startswith("#"):
                    os.environ.setdefault(clave.strip(), valor.strip().strip('"'))


def _datos_por_defecto() -> str:
    base = os.environ.get("LOCALAPPDATA") or str(Path.home() / ".local" / "share")
    return str(Path(base) / "NeuroAcceso" / "neuroacceso.db")


def main() -> None:
    p = argparse.ArgumentParser(prog="neuroacceso_motor", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--demo", action="store_true", help="casco simulado")
    p.add_argument("--replay", metavar="ARCHIVO", help="reproducir una grabación JSONL")
    p.add_argument("--grabar", metavar="ARCHIVO", help="grabar la sesión en JSONL")
    p.add_argument("--escritorio", action="store_true", help="abrir la ventana de la aplicación")
    p.add_argument("--dev", action="store_true", help="permitir el servidor de Vite (5173)")
    p.add_argument("--puerto", type=int, default=8765)
    p.add_argument("--datos", default=_datos_por_defecto(), help="base de datos SQLite")
    p.add_argument("--sin-raton", action="store_true", help="no mover el ratón real")
    p.add_argument("--sin-atajos", action="store_true", help="sin atajos de emergencia")
    p.add_argument("--frontend", type=Path, default=RAIZ / "frontend" / "dist")
    a = p.parse_args()
    _cargar_env()

    fuente = "simulador" if a.demo else "replay" if a.replay else "cortex"
    config = Config(fuente=fuente, demo=a.demo, dev=a.dev, puerto=a.puerto, datos=a.datos,  # type: ignore[arg-type]
                    sistema=not a.sin_raton, atajos=not a.sin_atajos, replay=a.replay,
                    grabar=a.grabar, frontend=a.frontend,
                    client_id=os.environ.get("EMOTIV_CLIENT_ID", ""),
                    client_secret=os.environ.get("EMOTIV_CLIENT_SECRET", ""),
                    cortex_url=os.environ.get("EMOTIV_CORTEX_URL", "wss://localhost:6868"))
    if a.escritorio:
        from .escritorio import ejecutar

        ejecutar(config)
        return
    # El token se imprime para desarrollo; en escritorio va en el fragmento de la URL.
    print(f"Motor en http://127.0.0.1:{a.puerto}/api/v1  ·  token: {config.token}", flush=True)
    print(f"Interfaz: http://127.0.0.1:{a.puerto}/#token={config.token}", flush=True)
    uvicorn.run(crear_app(config), host="127.0.0.1", port=a.puerto, log_level="warning")


if __name__ == "__main__":
    main()
