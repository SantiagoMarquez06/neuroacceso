import math
import statistics

import pytest

from neuroacceso_motor.contrato import Intento
from neuroacceso_motor.metricas import calcular, throughput


def intento(n, dx, mt_ms, a=256.0, w=32.0, acierto=True):
    return Intento(n=n, t_inicio_ms=0, t_fin_ms=mt_ms, objetivo={"x": a, "y": 0, "ancho": w},
                   origen={"x": 0, "y": 0}, clic={"x": a + dx, "y": 5}, acierto=acierto)


def test_throughput_caso_calculado_a_mano():
    desvios = [-6.0, -2.0, 0.0, 3.0, 5.0]
    ints = [intento(i, d, 1000) for i, d in enumerate(desvios)]
    we = 4.133 * statistics.stdev(desvios)
    ae = statistics.fmean(256 + d for d in desvios)
    assert throughput(ints) == pytest.approx(math.log2(ae / we + 1) / 1.0)


def test_throughput_promedia_condiciones_y_omite_insuficientes():
    a = [intento(i, d, 800, a=200) for i, d in enumerate([-4, 0, 4])]
    b = [intento(i, d, 1200, a=400, w=60) for i, d in enumerate([-8, 0, 8])]
    solo = [intento(0, 1, 900, a=600)]  # una sola muestra: sin ancho efectivo
    tp = throughput(a + b + solo)
    assert tp == pytest.approx((throughput(a) + throughput(b)) / 2)


def test_sin_dispersion_no_hay_throughput():
    assert throughput([intento(i, 0, 1000) for i in range(3)]) is None


def test_calcular_metricas_de_sesion():
    ints = [intento(i, d, 1000, acierto=i != 0) for i, d in enumerate([-3, 0, 3, 1])]
    m = calcular("practica", "2026-11-16T10:00:00+00:00", "2026-11-16T10:02:00+00:00", ints,
                 [{"texto": "HOLA", "duracion_ms": 12000}])
    assert m.precision == 0.75
    assert m.falsos_positivos_min == pytest.approx(0.5)
    assert m.tiempo_medio_ms == 1000
    assert m.caracteres_min == pytest.approx(20)
