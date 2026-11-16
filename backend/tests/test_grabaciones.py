"""Reproducción de las grabaciones de grabaciones/*.jsonl: el motor completo con datos registrados.

Cada grabación nueva del casco real que se suba a esa carpeta entra automáticamente aquí.
"""

import asyncio
from pathlib import Path

import pytest

from neuroacceso_motor import atajos
from neuroacceso_motor.actuadores import RatonFalso
from neuroacceso_motor.datos import Datos
from neuroacceso_motor.eventos import Hub
from neuroacceso_motor.fuentes.replay import Replay
from neuroacceso_motor.motor import Motor

GRABACIONES = sorted((Path(__file__).parents[1] / "grabaciones").glob("*.jsonl"))
LATENCIA_MAX_MS = 30


async def reproducir(archivo: Path) -> tuple[Motor, RatonFalso, list[str]]:
    raton, hub = RatonFalso(), Hub()
    cola = hub.suscribir()
    motor = Motor(lambda: Replay(archivo, velocidad=0), raton, Datos(":memory:"), hub)
    motor.conectar()
    tipos: list[str] = []
    while True:  # la grabación termina → el motor reporta el fin de la fuente
        tipo, datos = await asyncio.wait_for(cola.get(), 10)
        tipos.append(tipo)
        if tipo == "error":
            break
    await motor.desconectar()
    return motor, raton, tipos


@pytest.mark.parametrize("archivo", GRABACIONES, ids=lambda p: p.name)
async def test_grabacion_se_procesa_completa(archivo):
    motor, raton, tipos = await reproducir(archivo)
    assert "calibracion" in tipos and "dispositivo" in tipos
    assert motor.estado.calibrado, "la grabación debe empezar mirando al frente para calibrar"
    assert any(o[0] == "mover" for o in raton.ordenes), "el cursor nunca se movió"


@pytest.mark.parametrize("archivo", GRABACIONES, ids=lambda p: p.name)
async def test_latencia_bajo_presupuesto(archivo):
    _, raton, _ = await reproducir(archivo)
    p50, p95 = raton.latencia_ms()
    assert p95 < LATENCIA_MAX_MS, f"p50={p50:.2f} ms, p95={p95:.2f} ms"


def test_hay_al_menos_una_grabacion():
    assert GRABACIONES


def test_atajos_de_emergencia(banco):
    banco.conectar_y_calibrar()
    atajos._pausar(banco.motor)
    assert banco.motor.estado.modo == "pausa"
    atajos._pausar(banco.motor)
    assert banco.motor.estado.modo == "cursor"
    atajos._calibrar(banco.motor)
    assert banco.motor.estado.modo == "calibrando"
    banco.motor.fuente = None
    atajos._calibrar(banco.motor)  # sin casco no falla


def test_url_de_escritorio_lleva_el_token_en_el_fragmento():
    from neuroacceso_motor.escritorio import url_ventana
    from neuroacceso_motor.main import Config

    c = Config(token="abc", puerto=9000)
    assert url_ventana(c) == "http://127.0.0.1:9000/#token=abc"
    assert url_ventana(c, "barra") == "http://127.0.0.1:9000/barra#token=abc"
