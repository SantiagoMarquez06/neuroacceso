"""API completa contra el motor con el casco simulado (TestClient arranca el ciclo de vida)."""

import time

import pytest
from fastapi.testclient import TestClient

from neuroacceso_motor.contrato import EVENTOS, Estado, Perfil, Sesion, Sobre
from neuroacceso_motor.main import Config, crear_app

TOKEN = "t"
OK = {"Authorization": f"Bearer {TOKEN}"}
WS = {"Host": "127.0.0.1:8765"}


@pytest.fixture
def c():
    app = crear_app(Config(token=TOKEN, fuente="simulador", demo=True))
    with TestClient(app, base_url="http://127.0.0.1", headers=OK) as cliente:
        cliente.app_ = app
        yield cliente


def esperar(cond, segundos=5.0):
    limite = time.time() + segundos
    while time.time() < limite:
        if cond():
            return True
        time.sleep(0.05)
    return False


def test_estado_y_conexion_automatica(c):
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    e = Estado.model_validate(c.get("/api/v1/estado").json())
    assert e.conexion.estado == "conectado" and e.conexion.casco_id == "EPOCX-SIMULADO"
    assert e.calibrado


def test_perfiles_crud_y_ajustes_en_caliente(c):
    p = Perfil.model_validate(c.post("/api/v1/perfiles", json={"nombre": " Ana "}).json())
    assert p.nombre == "Ana"
    assert c.post("/api/v1/perfiles", json={"nombre": ""}).json()["codigo"] == "VALIDACION"
    editado = c.patch(f"/api/v1/perfiles/{p.id}", json={"nombre": "Ana M."}).json()
    assert editado["nombre"] == "Ana M."
    assert len(c.get("/api/v1/perfiles").json()) == 1
    assert c.post(f"/api/v1/perfiles/{p.id}/activar").json()["perfil_activo_id"] == p.id
    a = c.get(f"/api/v1/perfiles/{p.id}/ajustes").json()
    a["cursor"]["ganancia_x"] = 40
    assert c.put(f"/api/v1/perfiles/{p.id}/ajustes", json=a).status_code == 200
    assert c.app_.state.motor.cursor.ajustes.ganancia_x == 40  # aplicado en caliente
    a["cursor"]["ganancia_x"] = 9999
    assert c.put(f"/api/v1/perfiles/{p.id}/ajustes", json=a).status_code == 422
    assert c.get("/api/v1/perfiles/nada").json()["codigo"] == "PERFIL_NO_ENCONTRADO"
    assert c.delete(f"/api/v1/perfiles/{p.id}").status_code == 204
    assert c.get("/api/v1/estado").json()["perfil_activo_id"] is None


def test_modo_y_calibracion(c):
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    assert c.put("/api/v1/modo", json={"modo": "comunicador"}).json()["modo"] == "comunicador"
    assert c.put("/api/v1/modo", json={"modo": "volar"}).status_code == 422
    assert c.post("/api/v1/calibracion", json={"tipo": "centro"}).status_code == 202
    assert c.get("/api/v1/estado").json()["modo"] == "calibrando"
    assert c.put("/api/v1/modo", json={"modo": "cursor"}).json()["codigo"] == "MODO_INVALIDO"
    assert c.delete("/api/v1/calibracion").status_code == 204
    assert c.get("/api/v1/estado").json()["modo"] == "comunicador"


def test_sesion_de_practica_con_metricas_y_csv(c):
    assert c.post("/api/v1/sesiones", json={"tipo": "practica"}).json()["codigo"] == \
        "PERFIL_NO_ENCONTRADO"
    p = c.post("/api/v1/perfiles", json={"nombre": "Ana"}).json()
    c.post(f"/api/v1/perfiles/{p['id']}/activar")
    s = Sesion.model_validate(c.post("/api/v1/sesiones", json={"tipo": "practica"}).json())
    intentos = [{"n": i, "t_inicio_ms": 0, "t_fin_ms": 900 + 50 * i,
                 "objetivo": {"x": 400, "y": 0, "ancho": 60}, "origen": {"x": 0, "y": 0},
                 "clic": {"x": 400 + (-1) ** i * 8 * (i % 3), "y": 2}, "acierto": i != 3,
                 "dpr": 1} for i in range(6)]
    assert c.post(f"/api/v1/sesiones/{s.id}/intentos", json=intentos).status_code == 204
    c.post(f"/api/v1/sesiones/{s.id}/enunciados",
           json={"texto": "TENGO SED", "duracion_ms": 30000, "selecciones": 20})
    f = Sesion.model_validate(c.post(f"/api/v1/sesiones/{s.id}/finalizar").json())
    assert f.fin and f.metricas.throughput_bps > 0 and f.metricas.precision == pytest.approx(5 / 6)
    assert f.metricas.caracteres_min == pytest.approx(18)
    assert c.post(f"/api/v1/sesiones/{s.id}/intentos", json=intentos).status_code == 409
    assert [x["id"] for x in c.get("/api/v1/sesiones", params={"perfil_id": p["id"]}).json()] \
        == [s.id]
    csv = c.get("/api/v1/sesiones/exportar.csv")
    assert csv.headers["content-type"].startswith("text/csv")
    assert "Ana,practica" in csv.text


def test_gestos_disponibles_y_voz(c):
    g = c.get("/api/v1/gestos/disponibles").json()
    assert "clench" in g["facial"]["inferior"] and "push" in g["mental"]
    assert c.post("/api/v1/voz/hablar", json={"texto": "Hola"}).status_code == 202
    assert c.app_.state.voz.frases == ["Hola"]


def test_websocket_hola_y_eventos_validos(c):
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    with c.websocket_connect(f"/api/v1/eventos?token={TOKEN}", headers=WS) as ws:
        hola = Sobre.model_validate(ws.receive_json())
        assert hola.tipo == "hola" and hola.seq == 1
        EVENTOS["hola"].model_validate(hola.datos)
        c.post("/api/v1/dev/simular/gesto", json={"gesto": "clench"})
        vistos, seq = set(), 1
        while not {"accion", "dispositivo", "orientacion", "gesto"} <= vistos:
            s = Sobre.model_validate(ws.receive_json())
            assert s.seq == seq + 1
            seq = s.seq
            EVENTOS[s.tipo].model_validate(s.datos)
            vistos.add(s.tipo)
    assert ("clic", 0, 0) in c.app_.state.raton.ordenes


def test_websocket_rechaza_sin_token(c):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect) as e:
        with c.websocket_connect("/api/v1/eventos?token=malo", headers=WS) as ws:
            ws.receive_json()
    assert e.value.code == 1008


def test_cerrar_ui_en_comunicador_vuelve_a_cursor(c):
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    with c.websocket_connect(f"/api/v1/eventos?token={TOKEN}", headers=WS) as ws:
        ws.receive_json()
        c.put("/api/v1/modo", json={"modo": "comunicador"})
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")


def test_entrenamiento_simulado_de_punta_a_punta(c):
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    with c.websocket_connect(f"/api/v1/eventos?token={TOKEN}", headers=WS) as ws:
        ws.receive_json()
        eid = c.post("/api/v1/entrenamiento", json={"deteccion": "mental", "accion": "push"})
        assert eid.status_code == 202
        fases = []
        while "exito" not in fases:
            s = ws.receive_json()
            if s["tipo"] == "entrenamiento":
                fases.append(s["datos"]["fase"])
        c.post(f"/api/v1/entrenamiento/{eid.json()['id']}/aceptar")
        while "guardado" not in fases:
            s = ws.receive_json()
            if s["tipo"] == "entrenamiento":
                fases.append(s["datos"]["fase"])
    assert fases == ["iniciado", "exito", "guardado"]
    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")


def test_dev_solo_en_demo():
    app = crear_app(Config(token=TOKEN, fuente="replay", replay="no-existe.jsonl",
                           autoconectar=False))
    cli = TestClient(app, base_url="http://127.0.0.1", headers=OK)
    assert cli.post("/api/v1/dev/simular/gesto", json={"gesto": "clench"}).status_code in (404, 405)


def test_interfaz_sin_build_y_spa(tmp_path):
    sin = TestClient(crear_app(Config(token=TOKEN, autoconectar=False)),
                     base_url="http://127.0.0.1")
    assert "motor en marcha" in sin.get("/").text
    (tmp_path / "index.html").write_text("<html>APP</html>")
    (tmp_path / "logo.svg").write_text("<svg/>")
    con = TestClient(crear_app(Config(token=TOKEN, autoconectar=False, frontend=tmp_path)),
                     base_url="http://127.0.0.1")
    assert con.get("/barra").text == "<html>APP</html>"   # ruta de la SPA
    assert con.get("/logo.svg").text == "<svg/>"
    assert con.get("/..%2F..%2Fsecreto").text == "<html>APP</html>"  # sin path traversal


def test_interfaz_nunca_abre_rutas_de_red(tmp_path, monkeypatch):
    """Una ruta UNC haría que Windows envíe credenciales NTLM aunque luego se rechace."""
    import pathlib

    (tmp_path / "index.html").write_text("<html>APP</html>")
    abiertas: list[str] = []
    original = pathlib.Path.resolve

    def espia(self, *a, **k):
        abiertas.append(str(self))
        return original(self, *a, **k)

    monkeypatch.setattr(pathlib.Path, "resolve", espia)
    cli = TestClient(crear_app(Config(token=TOKEN, autoconectar=False, frontend=tmp_path)),
                     base_url="http://127.0.0.1")
    for ruta in ["///evil.com/share/x", "/%5C%5Cevil.com%5Cshare%5Cx", "/C:/Windows/win.ini",
                 "/..%2F..%2Fsecreto"]:
        assert cli.get(ruta).text == "<html>APP</html>"
    raiz = str(tmp_path.resolve())
    assert all(a.startswith(raiz) and not a.startswith("\\\\") for a in abiertas), abiertas


def test_entrenamiento_rechazado_por_cortex_no_atasca(c):
    from neuroacceso_motor.fuentes.base import FuenteError

    assert esperar(lambda: c.get("/api/v1/estado").json()["modo"] == "cursor")
    sim = c.app_.state.simulador

    async def falla(*_a):
        raise FuenteError("TOKEN_CORTEX_EXPIRADO", "sin perfil cargado")

    sim.entrenar = falla
    r = c.post("/api/v1/entrenamiento", json={"deteccion": "mental", "accion": "push"})
    assert r.status_code == 502 and r.json()["codigo"] == "TOKEN_CORTEX_EXPIRADO"
    assert c.get("/api/v1/estado").json()["modo"] == "cursor"
