"""Punto de entrada del ejecutable (PyInstaller): abre la aplicación de escritorio por defecto."""

import sys
from pathlib import Path

from neuroacceso_motor.__main__ import main

if __name__ == "__main__":
    if "--escritorio" not in sys.argv and "--consola" not in sys.argv:
        sys.argv.append("--escritorio")
    sys.argv = [a for a in sys.argv if a != "--consola"]
    empaquetado = getattr(sys, "_MEIPASS", None)
    if empaquetado and "--frontend" not in sys.argv:
        sys.argv += ["--frontend", str(Path(empaquetado) / "frontend")]
    main()
