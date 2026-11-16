"""Punto de entrada: python -m neuroacceso_motor [--demo] [--dev] [--puerto N]"""

import argparse

import uvicorn

from .main import Config, crear_app


def main() -> None:
    p = argparse.ArgumentParser(prog="neuroacceso_motor")
    p.add_argument("--demo", action="store_true", help="casco simulado")
    p.add_argument("--dev", action="store_true", help="permitir el servidor de Vite (5173)")
    p.add_argument("--puerto", type=int, default=8765)
    a = p.parse_args()

    config = Config(fuente="simulador" if a.demo else "cortex", demo=a.demo, dev=a.dev,
                    puerto=a.puerto)
    # El token se imprime para desarrollo; en escritorio se inyecta en la ventana.
    print(f"Motor en http://127.0.0.1:{a.puerto}/api/v1  ·  token: {config.token}", flush=True)
    uvicorn.run(crear_app(config), host="127.0.0.1", port=a.puerto, log_level="warning")


if __name__ == "__main__":
    main()
