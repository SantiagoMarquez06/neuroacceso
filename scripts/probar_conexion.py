"""Primera prueba: conecta con el casco y muestra en consola los datos que llegan.

Uso:
    python scripts/probar_conexion.py            # muestra fac, mot y dev
    python scripts/probar_conexion.py --info     # además lista los gestos posibles
    python scripts/probar_conexion.py --streams fac com
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from neuroacceso import config  # noqa: E402
from neuroacceso.cortex_client import CortexClient, CortexError  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--streams", nargs="+", default=["fac", "mot", "dev"])
    p.add_argument("--info", action="store_true", help="mostrar getDetectionInfo")
    args = p.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        cliente = CortexClient(config.CLIENT_ID, config.CLIENT_SECRET)
    except CortexError as e:
        sys.exit(f"Error: {e}")
    ultimo_mot = [0.0]

    def mostrar(stream):
        def _cb(muestra, t):
            if stream == "mot":  # mot llega muy rápido: mostrar como mucho 2 veces por segundo
                if time.time() - ultimo_mot[0] < 0.5:
                    return
                ultimo_mot[0] = time.time()
            if stream == "fac" and muestra.get("eyeAct") == "neutral" \
                    and muestra.get("lAct") == "neutral" and muestra.get("uAct") == "neutral":
                return  # no llenar la consola con "neutral"
            print(f"[{stream}] {json.dumps(muestra, ensure_ascii=False)}")
        return _cb

    for s in args.streams:
        cliente.on(s, mostrar(s))

    try:
        cliente.iniciar(args.streams)
        if args.info:
            print("Gestos faciales:", json.dumps(cliente.info_deteccion("facialExpression"), indent=2))
            print("Comandos mentales:", json.dumps(cliente.info_deteccion("mentalCommand"), indent=2))
        print("\nRecibiendo datos… prueba a apretar la mandíbula o guiñar. Ctrl+C para salir.\n")
        while True:
            time.sleep(0.5)
    except CortexError as e:
        sys.exit(f"Error: {e}")
    except KeyboardInterrupt:
        pass
    finally:
        cliente.cerrar()


if __name__ == "__main__":
    main()
