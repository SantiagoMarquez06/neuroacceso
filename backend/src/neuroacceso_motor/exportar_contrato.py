"""Genera los archivos de contrato/ desde los modelos del código.

    python -m neuroacceso_motor.exportar_contrato              # escribe
    python -m neuroacceso_motor.exportar_contrato --comprobar  # falla si están desactualizados
"""

import json
import sys
from pathlib import Path

from .contrato import EJEMPLOS, EVENTOS, Ajustes, Estado, Salud, Sobre
from .main import Config, crear_app

CONTRATO = Path(__file__).resolve().parents[3] / "contrato"


def _json(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def generar() -> dict[str, str]:
    """Ruta relativa en contrato/ → contenido."""
    archivos = {"openapi.json": _json(crear_app(Config(token="-")).openapi()),
                "ws/sobre.schema.json": _json(Sobre.model_json_schema())}
    for tipo, modelo in EVENTOS.items():
        archivos[f"ws/{tipo}.schema.json"] = _json(modelo.model_json_schema())
    for i, (tipo, datos) in enumerate(EJEMPLOS.items(), start=1):
        sobre = Sobre(tipo=tipo, seq=i, t=1763300000000 + i, datos=datos.model_dump(mode="json"))
        archivos[f"ejemplos/ws/{tipo}.json"] = _json(sobre.model_dump(mode="json"))
    rest = {"salud": Salud(version="0.1.0", fuente="simulador", demo=True),
            "estado": EJEMPLOS["hola"].estado,  # type: ignore[attr-defined]
            "ajustes": Ajustes(), "estado-inicial": Estado()}
    for nombre, modelo in rest.items():
        archivos[f"ejemplos/rest/{nombre}.json"] = _json(modelo.model_dump(mode="json"))
    return archivos


def desactualizados() -> list[str]:
    return [r for r, c in generar().items()
            if not (CONTRATO / r).exists()
            or (CONTRATO / r).read_text(encoding="utf-8").replace("\r\n", "\n") != c]


def main() -> None:
    if "--comprobar" in sys.argv:
        malos = desactualizados()
        if malos:
            sys.exit("Contrato desactualizado, ejecuta exportar_contrato: " + ", ".join(malos))
        print("Contrato al día")
        return
    for ruta, contenido in generar().items():
        destino = CONTRATO / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(contenido, encoding="utf-8", newline="\n")
    print(f"Contrato exportado en {CONTRATO}")


if __name__ == "__main__":
    main()
