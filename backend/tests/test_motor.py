import asyncio

import pytest

from neuroacceso_motor.contrato import EVENTOS, Ajustes, AjustesDwell
from neuroacceso_motor.fuentes.base import FuenteError, Mental, Sistema
from neuroacceso_motor.motor import ModoInvalido

from .conftest import FuenteLista, cara, mov


def test_conexion_calibra_y_pasa_a_cursor(banco):
    banco.conectar_y_calibrar()
    assert banco.motor.estado.modo == "cursor" and banco.motor.estado.calibrado
    cal = banco.eventos("calibracion")
    assert cal[0]["estado"] == "en_curso" and cal[-1]["estado"] == "completada"


def test_todos_los_eventos_cumplen_el_contrato(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(mov(yaw=-3))
    banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.9))
    for e in banco.eventos():
        EVENTOS[e.pop("tipo")].model_validate(e)


def test_cabeza_mueve_el_raton(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(mov(yaw=-2))
    movs = [o for o in banco.raton.ordenes if o[0] == "mover"]
    assert movs and movs[-1][1] > 0


def test_mandibula_hace_clic_una_sola_vez(banco):
    banco.conectar_y_calibrar()
    for _ in range(5):  # gesto sostenido
        banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.9))
    assert [o[0] for o in banco.raton.ordenes if o[0] != "mover"] == ["clic"]
    acc = banco.eventos("accion")
    assert acc[-1]["accion"] == "clic" and acc[-1]["ejecutada"]


def test_gesto_bajo_umbral_dispara_al_superarlo(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.1))
    assert not [o for o in banco.raton.ordenes if o[0] == "clic"]
    banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.8))
    assert [o for o in banco.raton.ordenes if o[0] == "clic"]


def test_antirrebote(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(cara(ojos="winkR"))
    banco.motor.procesar(cara())
    banco.motor.procesar(cara(ojos="winkR"))
    acc = banco.eventos("accion")
    assert acc[0]["ejecutada"] and acc[1]["motivo"] == "cooldown"


def test_pausa_con_guino_izquierdo(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(cara(ojos="winkL"))
    assert banco.motor.estado.modo == "pausa" and banco.motor.estado.pausado
    banco.motor._ultima_accion = 0
    banco.motor.procesar(cara())
    banco.motor.procesar(cara(ojos="winkR"))
    assert banco.eventos("accion")[-1]["motivo"] == "pausado"
    antes = len(banco.raton.ordenes)
    banco.motor.procesar(mov(yaw=-5))
    assert len(banco.raton.ordenes) == antes  # en pausa no se mueve


def test_comunicador_emite_entrada_y_no_toca_el_raton(banco):
    banco.conectar_y_calibrar()
    banco.motor.cambiar_modo("comunicador")
    antes = list(banco.raton.ordenes)
    banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.9))
    banco.motor.procesar(mov(yaw=-5))
    assert banco.eventos("entrada") == [{"tipo": "entrada", "accion": "seleccionar"}]
    assert banco.raton.ordenes == antes  # ni movimiento ni clics


def test_gesto_de_rescate_alterna_modos(banco):
    banco.conectar_y_calibrar()
    banco.motor.procesar(cara(superior="surprise", potencia_superior=0.9))
    assert banco.motor.estado.modo == "comunicador"
    banco.motor._ultima_accion = 0
    banco.motor.procesar(cara())
    banco.motor.procesar(cara(superior="surprise", potencia_superior=0.9))
    assert banco.motor.estado.modo == "cursor"
    assert banco.eventos("modo")[-1]["motivo"] == "gesto_rescate"


def test_interfaz_desconectada_vuelve_a_cursor(banco):
    banco.conectar_y_calibrar()
    banco.motor.cambiar_modo("comunicador")
    banco.hub.quitar(banco._cola)  # se va el único cliente
    banco.motor.interfaz_desconectada()
    assert banco.motor.estado.modo == "cursor"


def test_modos_invalidos(banco):
    with pytest.raises(ModoInvalido):
        banco.motor.cambiar_modo("cursor")  # desconectado
    with pytest.raises(ModoInvalido):
        banco.motor.iniciar_calibracion()   # sin fuente


def test_cancelar_calibracion_sin_centro_queda_en_pausa(banco):
    banco.motor.fuente = banco.fuente
    banco.motor.iniciar_calibracion()
    banco.motor.cancelar_calibracion()
    assert banco.motor.estado.modo == "pausa" and not banco.motor.estado.calibrado


def test_recalibrar_conserva_el_modo(banco):
    banco.conectar_y_calibrar()
    banco.motor.cambiar_modo("comunicador")
    banco.motor.iniciar_calibracion()
    banco.motor.cancelar_calibracion()
    assert banco.motor.estado.modo == "comunicador"


def test_clic_por_permanencia(banco, monkeypatch):
    banco.conectar_y_calibrar()
    a = Ajustes(dwell=AjustesDwell(activo=True, ms=300, radio_px=10))
    banco.motor.aplicar_ajustes("p", a)
    reloj = iter([100.0, 100.1, 100.5, 101.0])
    monkeypatch.setattr("neuroacceso_motor.motor.time.monotonic", lambda: next(reloj))
    banco.motor.procesar(mov(yaw=-3))   # se mueve: arma
    banco.motor.procesar(mov(yaw=-3))
    banco.motor.procesar(mov(yaw=-3))   # 400 ms quieto
    assert ("clic", 0, 0) in banco.raton.ordenes
    assert banco.eventos("accion")[-1]["origen"]["tipo"] == "dwell"


def test_comando_mental_mapeado(banco):
    banco.conectar_y_calibrar()
    a = Ajustes()
    a.gestos.mapeo.cursor["push"] = "clic"
    banco.motor.aplicar_ajustes("p", a)
    banco.motor.procesar(Mental(t=0, accion="push", potencia=0.7))
    assert banco.eventos("accion")[-1]["origen"] == {"tipo": "mental", "nombre": "push"}


async def test_entrenamiento_completo(banco):
    banco.conectar_y_calibrar()
    eid = await banco.motor.entrenar("mental", "push")
    assert eid and banco.motor.estado.modo == "entrenando"
    for ev in ("MC_Started", "MC_Succeeded"):
        banco.motor.procesar(Sistema(t=0, evento=ev))
    await banco.motor.responder_entrenamiento(True)
    banco.motor.procesar(Sistema(t=0, evento="MC_Completed"))
    assert [e["fase"] for e in banco.eventos("entrenamiento")] == ["iniciado", "exito", "guardado"]
    assert banco.motor.estado.modo == "cursor"
    assert banco.fuente.entrenos == [("mentalCommand", "push", "start"),
                                     ("mentalCommand", "push", "accept")]


async def test_ciclo_reintenta_tras_un_error():
    from .conftest import Banco

    b = Banco()
    llamadas = 0

    class Falla(FuenteLista):
        async def abrir(self):
            nonlocal llamadas
            llamadas += 1
            raise FuenteError("SIN_CASCO", "no hay casco")

    b.motor.crear_fuente = lambda: Falla()
    import neuroacceso_motor.motor as m

    m_espera = m.REINTENTO_MAX_S
    b.motor.conectar()
    await asyncio.sleep(1.5)
    await b.motor.desconectar()
    m.REINTENTO_MAX_S = m_espera
    assert llamadas >= 2
    errores = b.eventos("error")
    assert errores and errores[0]["codigo"] == "SIN_CASCO"
    assert b.motor.estado.conexion.estado == "desconectado"


async def test_ciclo_conecta_y_calibra_con_fuente():
    from .conftest import Banco

    b = Banco()
    b.fuente = FuenteLista([mov() for _ in range(80)])
    b.motor.conectar()
    await asyncio.sleep(0.3)
    assert b.motor.estado.conexion.estado == "conectado"
    assert b.motor.estado.modo == "cursor"
    await b.motor.desconectar()
    assert b.motor.estado.modo == "desconectado"


def test_muestras_mentales_intercaladas_no_repiten_el_gesto(banco):
    banco.conectar_y_calibrar()
    for _ in range(3):  # así llegan del casco: fac y com alternados
        banco.motor.procesar(cara(inferior="clench", potencia_inferior=0.9))
        banco.motor.procesar(Mental(t=0, accion="neutral", potencia=0))
    assert len(banco.eventos("gesto")) == 1
    assert [o[0] for o in banco.raton.ordenes if o[0] != "mover"] == ["clic"]
