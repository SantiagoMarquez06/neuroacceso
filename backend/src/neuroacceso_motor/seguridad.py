"""Seguridad de la API local.

Escuchar en 127.0.0.1 no basta: cualquier web abierta en el navegador puede llamar a un
WebSocket local (no aplica CORS) y mover el ratón. Por eso: token por arranque + Origin + Host.
"""

import hmac
from collections.abc import Iterable

from fastapi import Request, WebSocket
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

HOSTS_PERMITIDOS = {"127.0.0.1", "localhost"}  # bloquea DNS rebinding
ORIGENES_DEV = {"http://localhost:5173", "http://127.0.0.1:5173"}  # servidor de Vite


def _error(status: int, codigo: str, mensaje: str) -> JSONResponse:
    return JSONResponse({"codigo": codigo, "mensaje": mensaje}, status_code=status)


def host_valido(host: str | None) -> bool:
    return bool(host) and host.rsplit(":", 1)[0].strip("[]") in HOSTS_PERMITIDOS  # type: ignore[union-attr]


def origen_valido(origen: str | None, permitidos: Iterable[str]) -> bool:
    """Sin Origin = cliente que no es un navegador (sigue necesitando token)."""
    return origen is None or origen in permitidos


def token_valido(recibido: str | None, esperado: str) -> bool:
    return recibido is not None and hmac.compare_digest(recibido, esperado)


def token_de_cabecera(valor: str | None) -> str | None:
    if valor and valor.lower().startswith("bearer "):
        return valor[7:].strip()
    return None


class Guardia(BaseHTTPMiddleware):
    """Valida Host, Origin y token en toda petición HTTP bajo /api/."""

    def __init__(self, app, token: str, origenes: set[str]):  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.token = token
        self.origenes = origenes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not host_valido(request.headers.get("host")):
            return _error(400, "ORIGEN_NO_PERMITIDO", "Host no permitido")
        if not origen_valido(request.headers.get("origin"), self.origenes):
            return _error(403, "ORIGEN_NO_PERMITIDO", "Origen no permitido")
        # Las preflight CORS no llevan token; el middleware de CORS las responde.
        if request.url.path.startswith("/api/") and request.method != "OPTIONS":
            if not token_valido(token_de_cabecera(request.headers.get("authorization")),
                                self.token):
                return _error(401, "NO_AUTORIZADO", "Token ausente o inválido")
        return await call_next(request)


async def autorizar_ws(ws: WebSocket, token: str, origenes: set[str]) -> bool:
    """Cierra el WebSocket con 1008 si no pasa los controles. El middleware HTTP no lo cubre."""
    if (host_valido(ws.headers.get("host"))
            and origen_valido(ws.headers.get("origin"), origenes)
            and token_valido(ws.query_params.get("token"), token)):
        return True
    await ws.close(code=1008)
    return False
