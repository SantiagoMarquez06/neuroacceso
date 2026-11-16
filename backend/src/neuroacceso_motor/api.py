"""API v1: REST para órdenes y consultas, WebSocket para eventos en tiempo real."""

import asyncio
import contextlib
import csv
import io
from typing import Any

from fastapi import APIRouter, FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from . import __version__, metricas
from .contrato import (
    Ajustes,
    CambioModo,
    CodigoError,
    EntrenamientoIniciado,
    Enunciado,
    Estado,
    GestosDisponibles,
    GestosFaciales,
    Intento,
    Metricas,
    ModoActual,
    PedirCalibracion,
    PedirConexion,
    PedirEntrenamiento,
    PedirVoz,
    Perfil,
    PerfilCrear,
    PerfilEditar,
    Salud,
    Sesion,
    SesionCrear,
    SimularCabeza,
    SimularContacto,
    SimularGesto,
)
from .eventos import sobre
from .fuentes.simulador import GESTOS, Simulador
from .motor import ModoInvalido, Motor
from .seguridad import autorizar_ws
from .voz import Voz

GESTOS_FACIALES = GestosFaciales(
    ojos=["blink", "winkL", "winkR", "lookL", "lookR"], superior=["surprise", "frown"],
    inferior=["clench", "smile", "laugh", "smirkLeft", "smirkRight"])
GESTOS_MENTALES = ["push", "pull", "lift", "drop", "left", "right"]


class ErrorAPI(Exception):
    def __init__(self, status: int, codigo: CodigoError, mensaje: str):
        self.status, self.codigo, self.mensaje = status, codigo, mensaje


def registrar(app: FastAPI, motor: Motor, voz: Voz, simulador: Simulador | None) -> None:
    config = app.state.config
    datos = motor.datos
    api = APIRouter(prefix="/api/v1")

    @app.exception_handler(ErrorAPI)
    async def _error(_: Request, e: ErrorAPI) -> JSONResponse:
        return JSONResponse({"codigo": e.codigo, "mensaje": e.mensaje}, status_code=e.status)

    @app.exception_handler(ModoInvalido)
    async def _modo(_: Request, e: ModoInvalido) -> JSONResponse:
        return JSONResponse({"codigo": "MODO_INVALIDO", "mensaje": str(e)}, status_code=409)

    def perfil_o_404(pid: str) -> Perfil:
        p = datos.perfil(pid)
        if p is None:
            raise ErrorAPI(404, "PERFIL_NO_ENCONTRADO", f"No existe el perfil {pid}")
        return p

    def sesion_o_404(sid: str) -> Sesion:
        s = datos.sesion(sid)
        if s is None:
            raise ErrorAPI(404, "VALIDACION", f"No existe la sesión {sid}")
        return s

    # ------------------------------------------------------------- estado
    @api.get("/salud", response_model=Salud)
    async def salud() -> Salud:
        return Salud(version=__version__, fuente=config.fuente, demo=config.demo)

    @api.get("/estado", response_model=Estado)
    async def estado() -> Estado:
        return motor.estado_actual()

    @api.post("/conexion", status_code=202)
    async def conectar(_: PedirConexion | None = None) -> Response:
        motor.conectar()
        return Response(status_code=202)

    @api.delete("/conexion", status_code=204)
    async def desconectar() -> Response:
        await motor.desconectar()
        return Response(status_code=204)

    @api.put("/modo", response_model=ModoActual)
    async def modo(c: CambioModo) -> ModoActual:
        motor.cambiar_modo(c.modo, "usuario")
        return ModoActual(modo=motor.estado.modo, pausado=motor.estado.pausado)

    @api.post("/calibracion", status_code=202)
    async def calibrar(_: PedirCalibracion | None = None) -> Response:
        motor.iniciar_calibracion()
        return Response(status_code=202)

    @api.delete("/calibracion", status_code=204)
    async def cancelar_calibracion() -> Response:
        motor.cancelar_calibracion()
        return Response(status_code=204)

    @api.get("/gestos/disponibles", response_model=GestosDisponibles)
    async def gestos() -> GestosDisponibles:
        return GestosDisponibles(facial=GESTOS_FACIALES, mental=GESTOS_MENTALES)

    # ------------------------------------------------------------ perfiles
    @api.get("/perfiles", response_model=list[Perfil])
    async def perfiles() -> list[Perfil]:
        return datos.perfiles()

    @api.post("/perfiles", response_model=Perfil, status_code=201)
    async def crear_perfil(p: PerfilCrear) -> Perfil:
        return datos.crear_perfil(p.nombre.strip(), p.cortex_profile)

    @api.get("/perfiles/{pid}", response_model=Perfil)
    async def perfil(pid: str) -> Perfil:
        return perfil_o_404(pid)

    @api.patch("/perfiles/{pid}", response_model=Perfil)
    async def editar_perfil(pid: str, p: PerfilEditar) -> Perfil:
        perfil_o_404(pid)
        return datos.editar_perfil(pid, p.model_dump(exclude_unset=True))  # type: ignore[return-value]

    @api.delete("/perfiles/{pid}", status_code=204)
    async def borrar_perfil(pid: str) -> Response:
        perfil_o_404(pid)
        datos.borrar_perfil(pid)
        if motor.estado.perfil_activo_id == pid:
            motor.estado.perfil_activo_id = None
            motor.aplicar_ajustes("", Ajustes())
        return Response(status_code=204)

    @api.post("/perfiles/{pid}/activar", response_model=Estado)
    async def activar(pid: str) -> Estado:
        perfil_o_404(pid)
        await motor.activar_perfil(pid)
        return motor.estado_actual()

    @api.get("/perfiles/{pid}/ajustes", response_model=Ajustes)
    async def ajustes(pid: str) -> Ajustes:
        perfil_o_404(pid)
        return datos.ajustes(pid)  # type: ignore[return-value]

    @api.put("/perfiles/{pid}/ajustes", response_model=Ajustes)
    async def guardar_ajustes(pid: str, a: Ajustes) -> Ajustes:
        perfil_o_404(pid)
        datos.guardar_ajustes(pid, a)
        if motor.estado.perfil_activo_id == pid:
            motor.aplicar_ajustes(pid, a)
        return a

    # ------------------------------------------------------------ sesiones
    @api.post("/sesiones", response_model=Sesion, status_code=201)
    async def crear_sesion(s: SesionCrear) -> Sesion:
        pid = motor.estado.perfil_activo_id
        if not pid or datos.perfil(pid) is None:
            raise ErrorAPI(409, "PERFIL_NO_ENCONTRADO",
                           "Activa un perfil antes de iniciar una sesión")
        return datos.crear_sesion(pid, s.tipo)

    @api.get("/sesiones", response_model=list[Sesion])
    async def sesiones(perfil_id: str | None = None, desde: str | None = None,
                       hasta: str | None = None) -> list[Sesion]:
        return datos.sesiones(perfil_id, desde, hasta)

    @api.get("/sesiones/exportar.csv")
    async def exportar(perfil_id: str | None = None) -> Response:
        nombres = {p.id: p.nombre for p in datos.perfiles()}
        campos = ["id", "perfil", "tipo", "inicio", "fin", "throughput_bps", "tiempo_medio_ms",
                  "precision", "falsos_positivos_min", "caracteres_min"]
        salida = io.StringIO()
        w = csv.writer(salida)
        w.writerow(campos)
        for s in datos.sesiones(perfil_id):
            m = s.metricas.model_dump() if s.metricas else {}
            w.writerow([s.id, nombres.get(s.perfil_id, s.perfil_id), s.tipo, s.inicio, s.fin or "",
                        *[_csv(m.get(c)) for c in campos[5:]]])
        return Response(salida.getvalue(), media_type="text/csv; charset=utf-8", headers={
            "Content-Disposition": 'attachment; filename="sesiones.csv"'})

    @api.get("/sesiones/{sid}", response_model=Sesion)
    async def sesion(sid: str) -> Sesion:
        return sesion_o_404(sid)

    @api.post("/sesiones/{sid}/intentos", status_code=204)
    async def intentos(sid: str, lista: list[Intento]) -> Response:
        if sesion_o_404(sid).fin:
            raise ErrorAPI(409, "VALIDACION", "La sesión ya terminó")
        datos.agregar_intentos(sid, lista)
        return Response(status_code=204)

    @api.post("/sesiones/{sid}/enunciados", status_code=204)
    async def enunciados(sid: str, e: Enunciado) -> Response:
        if sesion_o_404(sid).fin:
            raise ErrorAPI(409, "VALIDACION", "La sesión ya terminó")
        datos.agregar_enunciado(sid, e.model_dump())
        return Response(status_code=204)

    @api.post("/sesiones/{sid}/finalizar", response_model=Sesion)
    async def finalizar(sid: str) -> Sesion:
        s = sesion_o_404(sid)
        if not s.fin:  # primero se fija la hora de fin; las métricas la necesitan
            s = datos.finalizar(sid, s.metricas or Metricas())  # type: ignore[assignment]
        m = metricas.calcular(s.tipo, s.inicio, s.fin, datos.intentos(sid), datos.enunciados(sid))
        return datos.finalizar(sid, m)  # type: ignore[return-value]

    # ------------------------------------------------------- entrenamiento
    @api.post("/entrenamiento", response_model=EntrenamientoIniciado, status_code=202)
    async def entrenar(p: PedirEntrenamiento) -> EntrenamientoIniciado:
        return EntrenamientoIniciado(id=await motor.entrenar(p.deteccion, p.accion))

    @api.post("/entrenamiento/{eid}/aceptar", status_code=204)
    async def aceptar(eid: str) -> Response:
        await motor.responder_entrenamiento(True)
        return Response(status_code=204)

    @api.post("/entrenamiento/{eid}/rechazar", status_code=204)
    async def rechazar(eid: str) -> Response:
        await motor.responder_entrenamiento(False)
        return Response(status_code=204)

    # ----------------------------------------------------------------- voz
    @api.post("/voz/hablar", status_code=202)
    async def hablar(p: PedirVoz) -> Response:
        voz.hablar(p.texto, motor.ajustes.voz.velocidad)
        return Response(status_code=202)

    # --------------------------------------------------------- simulación
    if simulador is not None:
        @api.post("/dev/simular/gesto", status_code=204)
        async def sim_gesto(p: SimularGesto) -> Response:
            if p.gesto not in GESTOS:
                raise ErrorAPI(422, "VALIDACION", f"Gesto desconocido: {p.gesto}")
            simulador.disparar(p.gesto)
            return Response(status_code=204)

        @api.post("/dev/simular/cabeza", status_code=204)
        async def sim_cabeza(p: SimularCabeza) -> Response:
            simulador.cabeza(p.yaw, p.pitch)
            return Response(status_code=204)

        @api.post("/dev/simular/contacto", status_code=204)
        async def sim_contacto(p: SimularContacto) -> Response:
            simulador.contacto(p.malo)
            return Response(status_code=204)

    # ----------------------------------------------------------- WebSocket
    @api.websocket("/eventos")
    async def eventos(ws: WebSocket) -> None:
        if not await autorizar_ws(ws, config.token, config.origenes):
            return
        await ws.accept()
        cola = motor.hub.suscribir()
        try:
            await ws.send_json(sobre("hola", motor.hola().model_dump(mode="json"), 1))
            await _bombear(ws, cola)
        finally:
            motor.hub.quitar(cola)
            motor.interfaz_desconectada()

    app.include_router(api)


async def _bombear(ws: WebSocket, cola: "asyncio.Queue[tuple[str, dict[str, Any]]]") -> None:
    """Envía eventos hasta que el cliente se desconecta (se detecta leyendo en paralelo)."""

    async def enviar() -> None:
        seq = 1
        while True:
            tipo, datos = await cola.get()
            seq += 1
            await ws.send_json(sobre(tipo, datos, seq))

    async def recibir() -> None:
        with contextlib.suppress(WebSocketDisconnect):
            while True:
                await ws.receive_text()  # los comandos van por REST; se ignora lo que llegue

    tareas = [asyncio.create_task(enviar()), asyncio.create_task(recibir())]
    try:
        await asyncio.wait(tareas, return_when=asyncio.FIRST_COMPLETED)
    finally:
        for t in tareas:
            t.cancel()
        for t in tareas:
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
                await t


def _csv(v: Any) -> str:
    return "" if v is None else (f"{v:.3f}" if isinstance(v, float) else str(v))
