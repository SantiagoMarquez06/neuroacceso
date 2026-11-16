"""Aplicación FastAPI del motor: arma las piezas y su ciclo de vida."""

import asyncio
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response

from . import __version__, api, atajos
from .actuadores import Raton, RatonFalso, RatonSO
from .contrato import Error, Fuente
from .datos import Datos
from .eventos import Hub
from .fuentes.base import Fuente as FuenteProto
from .fuentes.cortex import URL as CORTEX_URL
from .fuentes.cortex import CortexFuente
from .fuentes.replay import Grabador, Replay
from .fuentes.simulador import Simulador
from .motor import Motor
from .seguridad import ORIGENES_DEV, Guardia
from .voz import Voz, VozFalsa, VozSO


@dataclass
class Config:
    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    fuente: Fuente = "cortex"
    demo: bool = False
    dev: bool = False                    # permite el servidor de Vite como origen
    puerto: int = 8765
    datos: str = ":memory:"              # el CLI usa un archivo en la carpeta del usuario
    sistema: bool = False                # True: ratón y voz reales del SO; False: falsos
    atajos: bool = False
    replay: str | None = None
    velocidad_replay: float = 1.0
    grabar: str | None = None
    client_id: str = ""
    client_secret: str = ""
    cortex_url: str = CORTEX_URL
    autoconectar: bool = True
    frontend: Path | None = None         # carpeta con el build de la interfaz (index.html)

    @property
    def origenes(self) -> set[str]:
        propios = {f"http://127.0.0.1:{self.puerto}", f"http://localhost:{self.puerto}"}
        return propios | (ORIGENES_DEV if self.dev else set())


def _fabrica(config: Config, simulador: Simulador | None):  # type: ignore[no-untyped-def]
    def crear() -> FuenteProto:
        fuente: FuenteProto
        if config.fuente == "simulador":
            assert simulador is not None
            fuente = simulador
        elif config.fuente == "replay":
            fuente = Replay(config.replay or "", config.velocidad_replay)
        else:
            fuente = CortexFuente(config.client_id, config.client_secret, config.cortex_url)
        return Grabador(fuente, config.grabar) if config.grabar else fuente
    return crear


def crear_app(config: Config | None = None) -> FastAPI:
    config = config or Config()
    simulador = Simulador() if config.fuente == "simulador" else None
    raton: Raton = RatonSO() if config.sistema else RatonFalso()
    voz: Voz = VozSO() if config.sistema else VozFalsa()
    motor = Motor(_fabrica(config, simulador), raton, Datos(config.datos), Hub())

    @asynccontextmanager
    async def ciclo(_: FastAPI) -> AsyncIterator[None]:
        teclas = atajos.iniciar(motor, asyncio.get_running_loop()) if config.atajos else None
        if config.autoconectar:
            motor.conectar()
        yield
        await motor.desconectar()
        raton.cerrar()
        voz.cerrar()
        if teclas is not None:
            teclas.stop()

    docs = config.dev  # la documentación interactiva solo en desarrollo
    app = FastAPI(title="NeuroAcceso — motor", version=__version__, lifespan=ciclo,
                  responses={401: {"model": Error}, 403: {"model": Error}},
                  docs_url="/docs" if docs else None, redoc_url=None,
                  openapi_url="/openapi.json" if docs else None)
    app.state.config, app.state.motor, app.state.simulador = config, motor, simulador
    app.state.raton, app.state.voz = raton, voz

    # Orden: Starlette ejecuta primero el último añadido → CORS responde las preflight.
    app.add_middleware(Guardia, token=config.token, origenes=config.origenes, dev=config.dev)
    if config.dev:
        app.add_middleware(CORSMiddleware, allow_origins=sorted(ORIGENES_DEV),
                           allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse({"codigo": "VALIDACION", "mensaje": "Datos no válidos",
                             "detalle": {"errores": exc.errors()}}, status_code=422)

    api.registrar(app, motor, voz, simulador)
    _servir_interfaz(app, config.frontend)
    return app


PAGINA_SIN_INTERFAZ = """<!doctype html><html lang="es"><meta charset="utf-8">
<title>NeuroAcceso</title><body style="font-family:sans-serif;background:#14161a;color:#e8eaed;
padding:40px"><h1>NeuroAcceso — motor en marcha</h1><p>La interfaz aún no está compilada
(<code>frontend/dist</code>). La API está en <code>/api/v1</code>.</p></body></html>"""


def _servir_interfaz(app: FastAPI, carpeta: Path | None) -> None:
    """Sirve el build de la interfaz; cualquier ruta que no sea /api devuelve index.html (SPA)."""
    raiz = carpeta.resolve() if carpeta and (carpeta / "index.html").is_file() else None

    @app.get("/{ruta:path}", include_in_schema=False)
    async def interfaz(ruta: str) -> Response:
        if ruta.startswith("api/"):
            return JSONResponse({"codigo": "VALIDACION", "mensaje": "Ruta no encontrada"}, 404)
        if raiz is None:
            return HTMLResponse(PAGINA_SIN_INTERFAZ)
        # Se valida ANTES de tocar el disco: en Windows, abrir una ruta UNC (\servidor) envía las
        # credenciales NTLM a ese servidor aunque luego se rechace la ruta.
        partes = PurePosixPath(ruta)
        if (ruta and "\\" not in ruta and ":" not in ruta and not partes.is_absolute()
                and ".." not in partes.parts and not ruta.startswith("/")):
            archivo = (raiz / ruta).resolve()
            if archivo.is_relative_to(raiz) and archivo.is_file():
                return FileResponse(archivo)
        return FileResponse(raiz / "index.html")
