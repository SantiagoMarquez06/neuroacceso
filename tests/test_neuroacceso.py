"""Pruebas automáticas. Ejecutar con:  python -m pytest -q"""

import math
import socket
import time

import pytest

from neuroacceso import config
from neuroacceso.cortex_client import CortexClient
from neuroacceso.gestos import DetectorGestos
from neuroacceso.head_mouse import cuaternion_a_yaw_pitch
from neuroacceso.simulador import EstadoCasco, ServidorCortexSimulado, yaw_pitch_a_cuaternion


def _puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("localhost", 0))
        return s.getsockname()[1]


def _esperar(cond, timeout=5.0):
    limite = time.time() + timeout
    while time.time() < limite:
        if cond():
            return True
        time.sleep(0.05)
    return False


# ------------------------------------------------------------------ unitarias
@pytest.mark.parametrize("yaw,pitch", [(0, 0), (30, 0), (-45, 10), (20, -25), (170, 5)])
def test_cuaternion_ida_y_vuelta(yaw, pitch):
    y, p = cuaternion_a_yaw_pitch(*yaw_pitch_a_cuaternion(yaw, pitch))
    assert math.isclose(y, yaw, abs_tol=1e-6)
    assert math.isclose(p, pitch, abs_tol=1e-6)


def test_gestos_umbral_y_antirrebote():
    acciones = []
    d = DetectorGestos({"clench": "clic", "winkR": "clic_derecho"},
                       lambda a, g: acciones.append(a), umbral=0.4, cooldown_s=0.5)
    neutro = {"eyeAct": "neutral", "uAct": "neutral", "uPow": 0, "lAct": "neutral", "lPow": 0}
    d.procesar({**neutro, "lAct": "clench", "lPow": 0.2})  # bajo el umbral
    assert acciones == []
    d.procesar({**neutro, "lAct": "clench", "lPow": 0.8})
    d.procesar({**neutro, "lAct": "clench", "lPow": 0.8})  # dentro del anti-rebote
    assert acciones == ["clic"]
    time.sleep(0.55)
    d.procesar({**neutro, "eyeAct": "winkR"})
    assert acciones == ["clic", "clic_derecho"]


def test_gesto_no_mapeado_se_ignora():
    acciones = []
    d = DetectorGestos({"clench": "clic"}, lambda a, g: acciones.append(a), cooldown_s=0)
    d.procesar({"eyeAct": "blink", "uAct": "neutral", "uPow": 0, "lAct": "neutral", "lPow": 0})
    assert acciones == []


# -------------------------------------------------- de punta a punta (simulador)
@pytest.fixture
def simulador():
    estado = EstadoCasco()
    servidor = ServidorCortexSimulado(estado, _puerto_libre())
    servidor.iniciar_en_hilo()
    return estado, servidor


def test_cliente_completo_contra_simulador(simulador):
    estado, servidor = simulador
    cliente = CortexClient("demo", "demo", url=f"ws://localhost:{servidor.puerto}")
    muestras = {"mot": [], "fac": [], "dev": []}
    for s in muestras:
        cliente.on(s, lambda m, t, s=s: muestras[s].append(m))
    acciones = []
    gestos = DetectorGestos(config.MAPEO_GESTOS_CURSOR, lambda a, g: acciones.append((a, g)),
                            cooldown_s=0)
    cliente.on("fac", gestos.procesar)

    cliente.iniciar(["mot", "fac", "dev", "eeg"])  # eeg debe fallar sin romper el resto
    try:
        assert cliente.headset_id == "EPOCX-SIMULADO"
        assert _esperar(lambda: all(len(v) > 0 for v in muestras.values()))

        # movimiento: el cuaternión recibido corresponde a la orientación simulada
        estado.yaw, estado.pitch = 25.0, -10.0
        time.sleep(0.3)
        m = muestras["mot"][-1]
        yaw, pitch = cuaternion_a_yaw_pitch(m["Q0"], m["Q1"], m["Q2"], m["Q3"])
        assert abs(yaw - 25) < 0.5 and abs(pitch + 10) < 0.5

        # gestos: apretar mandíbula → clic; guiño derecho → clic derecho
        cliente.call("simularGesto", {"gesto": "clench"})
        assert _esperar(lambda: ("clic", "clench") in acciones)
        time.sleep(0.5)
        cliente.call("simularGesto", {"gesto": "winkR"})
        assert _esperar(lambda: ("clic_derecho", "winkR") in acciones)

        # calidad de contacto
        d = muestras["dev"][-1]
        assert set(d["contacto"]) >= {"AF3", "O2", "OVERALL"}
        cliente.call("simularContacto", {"malo": True})
        assert _esperar(lambda: muestras["dev"][-1]["contacto"]["OVERALL"] < 100, 3)
    finally:
        cliente.cerrar()


def test_info_deteccion(simulador):
    _, servidor = simulador
    cliente = CortexClient("demo", "demo", url=f"ws://localhost:{servidor.puerto}")
    cliente.iniciar(["fac"])
    try:
        acciones = cliente.info_deteccion("facialExpression")["actions"]
        assert {"clench", "winkL", "winkR"} <= set(acciones)
    finally:
        cliente.cerrar()


def test_aviso_si_se_pierde_la_conexion():
    import subprocess
    import sys

    puerto = _puerto_libre()
    sim = subprocess.Popen([sys.executable, "-m", "neuroacceso.simulador", "--sin-panel",
                            "--puerto", str(puerto)], stdout=subprocess.DEVNULL)
    try:
        cliente = CortexClient("demo", "demo", url=f"ws://localhost:{puerto}")
        perdida = []
        cliente.al_desconectar = lambda: perdida.append(True)
        assert _esperar(lambda: _intentar(cliente.conectar), 10)
        sim.terminate()
        assert _esperar(lambda: perdida, 5)
    finally:
        sim.kill()


def _intentar(f) -> bool:
    try:
        f()
        return True
    except Exception:
        return False
