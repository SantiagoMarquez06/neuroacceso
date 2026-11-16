import pytest
from fastapi import WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from neuroacceso_motor.contrato import EJEMPLOS, EVENTOS, Salud
from neuroacceso_motor.exportar_contrato import desactualizados
from neuroacceso_motor.main import Config, crear_app
from neuroacceso_motor.seguridad import autorizar_ws

TOKEN = "secreto-de-prueba"
OK = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def cliente():
    app = crear_app(Config(token=TOKEN, fuente="simulador", demo=True))

    @app.websocket("/api/v1/prueba-ws")  # endpoint mínimo para probar la guardia del WS
    async def _ws(ws: WebSocket) -> None:
        if await autorizar_ws(ws, TOKEN, app.state.config.origenes):
            await ws.accept()
            await ws.send_text("ok")
            await ws.close()

    return TestClient(app, base_url="http://127.0.0.1")


def test_salud_con_token_cumple_contrato(cliente):
    r = cliente.get("/api/v1/salud", headers=OK)
    assert r.status_code == 200
    s = Salud.model_validate(r.json())
    assert s.api_version == 1 and s.demo and s.fuente == "simulador"


@pytest.mark.parametrize("cabeceras", [{}, {"Authorization": "Bearer otro"},
                                       {"Authorization": TOKEN}])
def test_sin_token_valido_401(cliente, cabeceras):
    r = cliente.get("/api/v1/salud", headers=cabeceras)
    assert r.status_code == 401
    assert r.json()["codigo"] == "NO_AUTORIZADO"


def test_origen_ajeno_403(cliente):
    r = cliente.get("/api/v1/salud", headers={**OK, "Origin": "https://malicioso.example"})
    assert r.status_code == 403
    assert r.json()["codigo"] == "ORIGEN_NO_PERMITIDO"


def test_origen_propio_permitido(cliente):
    r = cliente.get("/api/v1/salud", headers={**OK, "Origin": "http://127.0.0.1:8765"})
    assert r.status_code == 200


def test_host_ajeno_rechazado(cliente):
    # DNS rebinding: un dominio externo que resuelve a 127.0.0.1
    r = cliente.get("/api/v1/salud", headers={**OK, "Host": "atacante.example:8765"})
    assert r.status_code == 400


def test_vite_solo_en_dev():
    origen = {"Origin": "http://localhost:5173"}
    sin_dev = TestClient(crear_app(Config(token=TOKEN)), base_url="http://127.0.0.1")
    con_dev = TestClient(crear_app(Config(token=TOKEN, dev=True)), base_url="http://127.0.0.1")
    assert sin_dev.get("/api/v1/salud", headers={**OK, **origen}).status_code == 403
    assert con_dev.get("/api/v1/salud", headers={**OK, **origen}).status_code == 200
    preflight = {**origen, "Access-Control-Request-Method": "GET",
                 "Access-Control-Request-Headers": "authorization"}
    pre = con_dev.options("/api/v1/salud", headers=preflight)
    assert pre.status_code == 200


def test_ws_exige_token_y_origen(cliente):
    host = {"Host": "127.0.0.1:8765"}  # el cliente de pruebas envía "testserver" en WS
    with cliente.websocket_connect(f"/api/v1/prueba-ws?token={TOKEN}", headers=host) as ws:
        assert ws.receive_text() == "ok"
    malicioso = {"Origin": "https://malicioso.example"}
    for url, cab in [("/api/v1/prueba-ws", host),
                     ("/api/v1/prueba-ws?token=malo", host),
                     (f"/api/v1/prueba-ws?token={TOKEN}", {**host, **malicioso}),
                     (f"/api/v1/prueba-ws?token={TOKEN}", {"Host": "atacante.example"})]:
        with pytest.raises(WebSocketDisconnect) as e:
            with cliente.websocket_connect(url, headers=cab) as ws:
                ws.receive_text()
        assert e.value.code == 1008


def test_ejemplos_validan_contra_su_modelo():
    for tipo, ejemplo in EJEMPLOS.items():
        EVENTOS[tipo].model_validate(ejemplo.model_dump(mode="json"))
    assert set(EJEMPLOS) == set(EVENTOS)


def test_contrato_exportado_al_dia():
    assert desactualizados() == [], "ejecuta: uv run python -m neuroacceso_motor.exportar_contrato"


def test_docs_solo_en_dev(cliente):
    # Fuera de dev esas rutas caen en la interfaz (SPA), no en la documentación.
    assert "swagger" not in cliente.get("/docs").text.lower()
    assert '"openapi"' not in cliente.get("/openapi.json").text


def test_options_sin_dev_exige_token(cliente):
    assert cliente.options("/api/v1/salud").status_code == 401
