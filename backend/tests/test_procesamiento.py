import math

import pytest

from neuroacceso_motor.contrato import AjustesCursor, AjustesDwell
from neuroacceso_motor.fuentes.base import Facial, Mental, Movimiento
from neuroacceso_motor.fuentes.simulador import yaw_pitch_a_cuaternion
from neuroacceso_motor.procesamiento import (
    MUESTRAS_CALIBRACION,
    Cursor,
    Permanencia,
    detectar,
    yaw_pitch,
)


@pytest.mark.parametrize("yaw,pitch", [(0, 0), (30, 0), (-45, 10), (20, -25), (170, 5)])
def test_cuaternion_ida_y_vuelta(yaw, pitch):
    y, p = yaw_pitch(yaw_pitch_a_cuaternion(yaw, pitch))
    assert math.isclose(y, yaw, abs_tol=1e-6) and math.isclose(p, pitch, abs_tol=1e-6)


def m(yaw=0.0, pitch=0.0):
    return Movimiento(t=0, q=yaw_pitch_a_cuaternion(yaw, pitch))


def calibrado(ajustes=None) -> Cursor:
    c = Cursor(ajustes or AjustesCursor(suavizado=0))
    c.calibrar()
    for _ in range(MUESTRAS_CALIBRACION):
        assert c.procesar(m()) is None
    assert not c.calibrando and c.centro is not None
    return c


def test_sin_calibrar_no_mueve():
    assert Cursor(AjustesCursor()).procesar(m(10)) is None


def test_girar_a_la_derecha_mueve_a_la_derecha():
    c = calibrado()
    c.procesar(m())
    dx, dy = c.procesar(m(yaw=-2))  # derecha = yaw negativo
    assert dx == pytest.approx(2 * 25) and dy == pytest.approx(0, abs=1e-6)
    assert c.orientacion[0] == pytest.approx(-2)


def test_mirar_abajo_mueve_abajo_y_invertir():
    c = calibrado(AjustesCursor(suavizado=0, invertir_y=True))
    c.procesar(m())
    _, dy = c.procesar(m(pitch=-1))
    assert dy == pytest.approx(-25)  # invertido


def test_zona_muerta_ignora_temblor():
    c = calibrado(AjustesCursor(suavizado=0, zona_muerta=0.5))
    c.procesar(m())
    assert c.procesar(m(yaw=0.2)) is None


def test_calibracion_reinicia_si_se_mueve():
    c = Cursor(AjustesCursor())
    c.calibrar()
    for _ in range(10):
        c.procesar(m())
    c.procesar(m(yaw=5))
    assert c.inestable and c.progreso < 0.05
    c.cancelar()
    assert not c.calibrando


def test_giroscopio_usa_sesgo():
    c = Cursor(AjustesCursor(suavizado=0, zona_muerta=0))
    c.calibrar()
    for _ in range(MUESTRAS_CALIBRACION):
        c.procesar(Movimiento(t=0, giro=(10.0, 5.0, 0.0)))
    dx, dy = c.procesar(Movimiento(t=0, giro=(110.0, 5.0, 0.0)))
    assert dx == pytest.approx(25) and dy == pytest.approx(0)


def test_detectar_gestos():
    assert detectar(Facial(t=0)) is None
    assert detectar(Facial(t=0, ojos="winkL")).zona == "ojos"
    g = detectar(Facial(t=0, inferior="clench", potencia_inferior=0.7))
    assert (g.gesto, g.zona, g.potencia) == ("clench", "inferior", 0.7)
    assert detectar(Facial(t=0, superior="surprise", potencia_superior=0.5)).zona == "superior"
    assert detectar(Mental(t=0, accion="push", potencia=0.6)).zona == "mental"
    assert detectar(Mental(t=0, accion="neutral", potencia=0)) is None


def test_permanencia():
    p = Permanencia(AjustesDwell(activo=True, ms=500, radio_px=20))
    assert not p.actualizar(50, 0, 0.0)          # se movió: queda armado
    assert not p.actualizar(1, 0, 0.3)
    assert p.actualizar(1, 0, 0.6)               # 600 ms quieto → clic
    assert not p.actualizar(0, 0, 2.0)           # no repite sin moverse
    assert not p.actualizar(30, 0, 2.1)
    assert p.actualizar(0, 0, 2.7)
