"""Cliente de prueba: imprime los eventos del motor.

    uv run python scripts/cliente_ws.py TOKEN [--puerto 8765] [--segundos 10] [--sin-orientacion]
"""

import argparse
import asyncio
import json

import websockets


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("token")
    p.add_argument("--puerto", type=int, default=8765)
    p.add_argument("--segundos", type=float, default=10)
    p.add_argument("--sin-orientacion", action="store_true")
    a = p.parse_args()
    url = f"ws://127.0.0.1:{a.puerto}/api/v1/eventos?token={a.token}"
    async with websockets.connect(url) as ws:
        try:
            async with asyncio.timeout(a.segundos):
                async for raw in ws:
                    m = json.loads(raw)
                    if a.sin_orientacion and m["tipo"] == "orientacion":
                        continue
                    datos = json.dumps(m["datos"], ensure_ascii=False)[:150]
                    print(f"[{m['seq']:>4}] {m['tipo']:<12} {datos}")
        except TimeoutError:
            pass


if __name__ == "__main__":
    asyncio.run(main())
