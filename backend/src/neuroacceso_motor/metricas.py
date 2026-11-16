"""Métricas de evaluación.

Rendimiento (throughput) según ISO 9241-411 con ancho efectivo (Soukoreff & MacKenzie, 2004):
    We = 4.133 · SD(dx)      dx = desvío del clic sobre el eje origen→objetivo
    Ae = media de la distancia efectiva recorrida
    IDe = log2(Ae / We + 1)  TP = IDe / MT (bits/s), promediado entre condiciones (A, W).
"""

import math
import statistics
from collections import defaultdict
from datetime import datetime
from typing import Any

from .contrato import Intento, Metricas


def throughput(intentos: list[Intento]) -> float | None:
    condiciones: dict[tuple[int, int], list[tuple[float, float, float]]] = defaultdict(list)
    for i in intentos:
        ax, ay = i.objetivo.x - i.origen.x, i.objetivo.y - i.origen.y
        a = math.hypot(ax, ay)
        mt = (i.t_fin_ms - i.t_inicio_ms) / 1000
        if a <= 0 or mt <= 0:
            continue
        ux, uy = ax / a, ay / a
        dx = (i.clic.x - i.objetivo.x) * ux + (i.clic.y - i.objetivo.y) * uy
        condiciones[(round(a), round(i.objetivo.ancho))].append((dx, a + dx, mt))
    tps = []
    for filas in condiciones.values():
        if len(filas) < 2:
            continue  # sin dispersión no hay ancho efectivo
        we = 4.133 * statistics.stdev(f[0] for f in filas)
        if we <= 0:
            continue
        ae = statistics.fmean(f[1] for f in filas)
        tps.append(math.log2(ae / we + 1) / statistics.fmean(f[2] for f in filas))
    return statistics.fmean(tps) if tps else None


def _minutos(inicio: str, fin: str | None) -> float | None:
    if not fin:
        return None
    m = (datetime.fromisoformat(fin) - datetime.fromisoformat(inicio)).total_seconds() / 60
    return m if m > 0 else None


def calcular(tipo: str, inicio: str, fin: str | None, intentos: list[Intento],
             enunciados: list[dict[str, Any]]) -> Metricas:
    m = Metricas()
    if intentos:
        m.throughput_bps = throughput(intentos)
        m.tiempo_medio_ms = statistics.fmean(i.t_fin_ms - i.t_inicio_ms for i in intentos)
        aciertos = sum(i.acierto for i in intentos)
        m.precision = aciertos / len(intentos)
        minutos = _minutos(inicio, fin)
        # Falsos positivos: clics que no alcanzaron su objetivo, por minuto de sesión.
        if minutos:
            m.falsos_positivos_min = (len(intentos) - aciertos) / minutos
    duracion = sum(float(e.get("duracion_ms", 0)) for e in enunciados)
    if enunciados and duracion > 0:
        m.caracteres_min = sum(len(str(e.get("texto", ""))) for e in enunciados) / duracion * 60000
    return m
