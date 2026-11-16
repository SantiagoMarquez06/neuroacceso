import asyncio
import json
import time

import pytest
import websockets

from neuroacceso_motor.fuentes.base import (
    Dispositivo,
    Facial,
    FuenteError,
    Mental,
    Movimiento,
    Sistema,
)
from neuroacceso_motor.fuentes.cortex import CortexFuente, convertir
from neuroacceso_motor.fuentes.replay import Grabador, Replay, a_json, de_json
from neuroacceso_motor.fuentes.simulador import Simulador

from .conftest import FuenteLista


async def tomar(fuente, n, timeout=5):
    salida = []

    async def leer():
        async for x in fuente.muestras():
            salida.append(x)
            if len(salida) >= n:
                return

    await asyncio.wait_for(leer(), timeout)
    return salida


# ----------------------------------------------------------------- replay
def test_json_ida_y_vuelta():
    muestras = [Movimiento(t=1.0, q=(1, 0, 0, 0)), Facial(t=1.1, ojos="winkL"),
                Dispositivo(t=1.2, bateria_pct=80, senal=1, contacto={"AF3": 4},
                            calidad_global=100),
                Mental(t=1.3, accion="push", potencia=0.5), Sistema(t=1.4, evento="MC_Started")]
    for m in muestras:
        assert de_json(a_json(m)) == m


async def test_grabar_y_reproducir(tmp_path):
    archivo = tmp_path / "sesion.jsonl"
    original = [Movimiento(t=10.0, q=(1, 0, 0, 0)), Facial(t=10.5, inferior="clench",
                                                          potencia_inferior=0.9)]
    g = Grabador(FuenteLista(original, terminar=True), archivo)
    await g.abrir()
    await tomar(g, 2)
    await g.cerrar()
    r = Replay(archivo, velocidad=0)
    assert (await r.abrir()).startswith("REPLAY:")
    assert await tomar(r, 2) == original


async def test_replay_respeta_tiempos(tmp_path):
    archivo = tmp_path / "s.jsonl"
    archivo.write_text("\n".join(a_json(Movimiento(t=t, q=(1, 0, 0, 0))) for t in (0, 0.2)))
    inicio = time.perf_counter()
    await tomar(Replay(archivo, velocidad=1), 2)
    assert time.perf_counter() - inicio >= 0.18


async def test_replay_sin_archivo():
    with pytest.raises(FuenteError) as e:
        await Replay("no-existe.jsonl").abrir()
    assert e.value.codigo == "SIN_CASCO"


# -------------------------------------------------------------- simulador
async def test_simulador_entrega_todos_los_tipos():
    s = Simulador(hz=200)
    await s.abrir()
    s.disparar("clench")
    tipos = {type(m).__name__ for m in await tomar(s, 40)}
    assert {"Movimiento", "Facial", "Mental", "Dispositivo"} <= tipos
    with pytest.raises(ValueError):
        s.disparar("inventado")


async def test_simulador_entrenamiento():
    s = Simulador(hz=200)
    await s.abrir()
    await s.entrenar("mentalCommand", "push", "start")
    eventos = [m.evento for m in await tomar(s, 400, timeout=5) if isinstance(m, Sistema)]
    assert eventos[:2] == ["MC_Started", "MC_Succeeded"]


# ------------------------------------------------------------------ cortex
def test_convertir_streams_de_cortex():
    mot = convertir("mot", ["COUNTER_MEMS", "INTERPOLATED_MEMS", "Q0", "Q1", "Q2", "Q3"],
                    [1, 0, 1.0, 0.0, 0.0, 0.0], 5.0)
    assert mot == Movimiento(t=5.0, q=(1.0, 0.0, 0.0, 0.0))
    giro = convertir("mot", ["GYROX", "GYROY", "GYROZ"], [1, 2, 3], 5.0)
    assert giro.giro == (1, 2, 3)
    fac = convertir("fac", ["eyeAct", "uAct", "uPow", "lAct", "lPow"],
                    ["neutral", "neutral", 0, "clench", 0.0576], 5.0)
    assert fac.inferior == "clench" and fac.potencia_inferior == pytest.approx(0.0576)
    dev = convertir("dev", ["Battery", "Signal", ["AF3", "F7", "OVERALL"], "BatteryPercent"],
                    [3, 1.0, [4, 2, 75], 70], 5.0)
    assert dev.contacto == {"AF3": 4, "F7": 2} and dev.calidad_global == 75
    assert dev.bateria_pct == 70
    assert convertir("com", ["act", "pow"], ["push", 0.4], 5.0).accion == "push"
    assert convertir("sys", ["event", "msg"], ["mentalCommand", "MC_Succeeded"], 5.0).evento \
        == "MC_Succeeded"


class CortexFalso:
    """Servidor mínimo que habla el JSON-RPC de Cortex."""

    def __init__(self, acceso=True, cascos=True, perfil_cargado=None):
        self.acceso, self.cascos, self.perfil_cargado = acceso, cascos, perfil_cargado
        self.llamadas: list[str] = []

    async def __call__(self, ws):
        emisor = None
        async for raw in ws:
            msg = json.loads(raw)
            metodo = msg["method"]
            self.llamadas.append(metodo if metodo != "setupProfile"
                                 else f"setupProfile:{msg['params']['status']}")
            r = {
                "requestAccess": {"accessGranted": self.acceso},
                "authorize": {"cortexToken": "tok"},
                "queryHeadsets": [{"id": "EPOCX-1", "status": "connected"}] if self.cascos else [],
                "controlDevice": {},
                "createSession": {"id": "ses-1"},
                "queryProfile": [{"name": "Ana"}],
                "getCurrentProfile": {"name": self.perfil_cargado},
                "setupProfile": {},
                "training": {},
                "subscribe": {"success": [
                    {"streamName": "mot", "cols": ["COUNTER_MEMS", "INTERPOLATED_MEMS",
                                                    "Q0", "Q1", "Q2", "Q3"], "sid": "s"},
                    {"streamName": "fac", "cols": ["eyeAct", "uAct", "uPow", "lAct", "lPow"],
                     "sid": "s"}], "failure": []},
            }.get(metodo)
            await ws.send(json.dumps({"jsonrpc": "2.0", "id": msg["id"], "result": r}))
            if metodo == "subscribe":
                emisor = asyncio.create_task(self._emitir(ws))
        if emisor:
            emisor.cancel()

    async def _emitir(self, ws):
        await ws.send(json.dumps({"mot": [1, 0, 1, 0, 0, 0], "sid": "s", "time": 1.0}))
        await ws.send(json.dumps({"fac": ["winkR", "neutral", 0, "neutral", 0], "sid": "s",
                                  "time": 1.1}))
        await asyncio.sleep(0.05)
        await ws.close()  # simula que se cae el Launcher


async def con_cortex(servidor, prueba):
    async with websockets.serve(servidor, "127.0.0.1", 0) as srv:
        puerto = srv.sockets[0].getsockname()[1]
        return await prueba(CortexFuente("id", "secreto", f"ws://127.0.0.1:{puerto}", timeout=3))


async def test_cortex_flujo_completo_y_desconexion():
    srv = CortexFalso()

    async def prueba(f):
        assert await f.abrir() == "EPOCX-1"
        recibidas = []
        with pytest.raises(FuenteError) as e:
            async for m in f.muestras():
                recibidas.append(m)
        await f.cerrar()
        return recibidas, e.value.codigo

    recibidas, codigo = await con_cortex(srv, prueba)
    assert recibidas[0] == Movimiento(t=1.0, q=(1, 0, 0, 0))
    assert recibidas[1].ojos == "winkR"
    assert codigo == "CASCO_DESCONECTADO"
    assert srv.llamadas[:5] == ["requestAccess", "authorize", "queryHeadsets", "createSession",
                                "subscribe"]


async def test_cortex_app_no_aprobada():
    async def prueba(f):
        with pytest.raises(FuenteError) as e:
            await f.abrir()
        await f.cerrar()
        return e.value.codigo

    assert await con_cortex(CortexFalso(acceso=False), prueba) == "APP_NO_APROBADA"


async def test_cortex_sin_launcher():
    f = CortexFuente("id", "secreto", "ws://127.0.0.1:1", timeout=2)
    with pytest.raises(FuenteError) as e:
        await f.abrir()
    assert e.value.codigo == "CORTEX_NO_DISPONIBLE"


def test_cortex_sin_credenciales():
    with pytest.raises(FuenteError) as e:
        CortexFuente("", "")
    assert e.value.codigo == "APP_NO_APROBADA"


async def test_cortex_cambiar_de_perfil_descarga_el_anterior():
    srv = CortexFalso(perfil_cargado="Pedro")

    async def prueba(f):
        await f.abrir()
        await f.cargar_perfil("Ana")
        await f.cerrar()

    await con_cortex(srv, prueba)
    i = srv.llamadas.index("getCurrentProfile")
    assert srv.llamadas[i + 1:i + 4] == ["setupProfile:unload", "queryProfile", "setupProfile:load"]


async def test_cortex_mismo_perfil_no_recarga():
    srv = CortexFalso(perfil_cargado="Ana")

    async def prueba(f):
        await f.abrir()
        await f.cargar_perfil("Ana")
        await f.cerrar()

    await con_cortex(srv, prueba)
    assert not [x for x in srv.llamadas if x.startswith("setupProfile")]
