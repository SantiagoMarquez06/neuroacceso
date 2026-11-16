"""Aplicación FastAPI del motor."""

import secrets
from dataclasses import dataclass, field

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .contrato import Error, Fuente, Salud
from .seguridad import ORIGENES_DEV, Guardia


@dataclass
class Config:
    token: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    fuente: Fuente = "cortex"
    demo: bool = False
    dev: bool = False  # permite el servidor de Vite como origen
    puerto: int = 8765

    @property
    def origenes(self) -> set[str]:
        propios = {f"http://127.0.0.1:{self.puerto}", f"http://localhost:{self.puerto}"}
        return propios | (ORIGENES_DEV if self.dev else set())


def crear_app(config: Config | None = None) -> FastAPI:
    config = config or Config()
    docs = config.dev  # la documentación interactiva solo en desarrollo
    app = FastAPI(title="NeuroAcceso — motor", version=__version__,
                  responses={401: {"model": Error}, 403: {"model": Error}},
                  docs_url="/docs" if docs else None, redoc_url=None,
                  openapi_url="/openapi.json" if docs else None)
    app.state.config = config

    # Orden: Starlette ejecuta primero el último añadido → CORS responde las preflight.
    app.add_middleware(Guardia, token=config.token, origenes=config.origenes, dev=config.dev)
    if config.dev:
        app.add_middleware(CORSMiddleware, allow_origins=sorted(ORIGENES_DEV),
                           allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse({"codigo": "VALIDACION", "mensaje": "Datos no válidos",
                             "detalle": {"errores": exc.errors()}}, status_code=422)

    api = APIRouter(prefix="/api/v1")

    @api.get("/salud", response_model=Salud)
    def salud() -> Salud:
        return Salud(version=__version__, fuente=config.fuente, demo=config.demo)

    app.include_router(api)
    return app
