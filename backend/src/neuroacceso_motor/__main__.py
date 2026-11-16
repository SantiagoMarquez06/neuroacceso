"""Punto de entrada: python -m neuroacceso_motor"""

from . import __version__


def main() -> None:
    print(f"NeuroAcceso motor {__version__}")


if __name__ == "__main__":
    main()
