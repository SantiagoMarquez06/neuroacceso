"""Fuente real: Emotiv Cortex API (JSON-RPC 2.0 sobre WebSocket local).

Portado de legacy/src/neuroacceso/cortex_client.py a asyncio.
Docs: https://emotiv.gitbook.io/cortex-api
"""

import asyncio
import itertools
import json
import ssl
from collections.abc import AsyncIterator
from typing import Any

import websockets

from .base import (
    Deteccion,
    Dispositivo,
    EstadoEntreno,
    Facial,
    FuenteError,
    Mental,
    Movimiento,
    Muestra,
    Sistema,
)

URL = "wss://localhost:6868"
STREAMS = ["mot", "fac", "dev", "com", "sys"]


def _ssl(url: str) -> ssl.SSLContext | None:
    if not url.startswith("wss://"):
        return None
    # Cortex usa un certificado autofirmado y solo escucha en localhost.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _error_cortex(metodo: str, err: dict[str, Any]) -> FuenteError:
    mensaje = f"{metodo}: {err.get('message')} (código {err.get('code')})"
    if "token" in str(err.get("message", "")).lower():
        return FuenteError("TOKEN_CORTEX_EXPIRADO", mensaje)
    if metodo in ("queryHeadsets", "controlDevice", "createSession"):
        return FuenteError("SIN_CASCO", mensaje)
    return FuenteError("CORTEX_NO_DISPONIBLE", mensaje)


def convertir(stream: str, cols: list[Any], valores: list[Any], t: float) -> Muestra | None:
    """Fila de un stream de Cortex → muestra normalizada (se leen siempre las `cols`)."""
    if stream == "sys":
        evento = next((v for v in valores if isinstance(v, str) and v[:3] in ("MC_", "FE_")), None)
        return Sistema(t=t, evento=evento) if evento else None
    d: dict[str, Any] = {}
    for c, v in zip(cols, valores, strict=False):
        if isinstance(c, list):  # en `dev`, la calidad por sensor viene anidada
            d["contacto"] = dict(zip(c, v, strict=False)) if isinstance(v, list) else {}
        else:
            d[c] = v
    if stream == "mot":
        if "Q0" in d:
            return Movimiento(t=t, q=(d["Q0"], d["Q1"], d["Q2"], d["Q3"]))
        if "GYROX" in d:
            return Movimiento(t=t, giro=(d["GYROX"], d["GYROY"], d["GYROZ"]))
        return None
    if stream == "fac":
        return Facial(t=t, ojos=d.get("eyeAct") or "neutral",
                      superior=d.get("uAct") or "neutral",
                      potencia_superior=float(d.get("uPow") or 0),
                      inferior=d.get("lAct") or "neutral",
                      potencia_inferior=float(d.get("lPow") or 0))
    if stream == "com":
        return Mental(t=t, accion=d.get("act") or "neutral", potencia=float(d.get("pow") or 0))
    if stream == "dev":
        contacto = {k: int(v) for k, v in d.get("contacto", {}).items() if k != "OVERALL"}
        global_ = d.get("contacto", {}).get("OVERALL")
        if global_ is None:
            global_ = round(sum(contacto.values()) / (4 * max(len(contacto), 1)) * 100)
        bateria = d.get("BatteryPercent")
        if bateria is None:
            bateria = int(d.get("Battery") or 0) * 25
        return Dispositivo(t=t, bateria_pct=int(bateria), senal=float(d.get("Signal") or 0),
                           contacto=contacto, calidad_global=int(global_))
    return None


class CortexFuente:
    def __init__(self, client_id: str, client_secret: str, url: str = URL,
                 timeout: float = 15):
        if not client_id or not client_secret:
            raise FuenteError("APP_NO_APROBADA", "Faltan EMOTIV_CLIENT_ID / EMOTIV_CLIENT_SECRET")
        self.client_id, self.client_secret, self.url, self.timeout = (
            client_id, client_secret, url, timeout)
        self._ids = itertools.count(1)
        self._pendientes: dict[int, asyncio.Future[dict[str, Any]]] = {}
        self._cols: dict[str, list[Any]] = {}
        self._cola: asyncio.Queue[Muestra | None] = asyncio.Queue(maxsize=1000)
        self._ws: Any = None
        self._lector: asyncio.Task[None] | None = None
        self.token: str | None = None
        self.sesion: str | None = None
        self.casco: str | None = None

    # -------------------------------------------------------------- JSON-RPC
    async def _llamar(self, metodo: str, params: dict[str, Any] | None = None) -> Any:
        rid = next(self._ids)
        fut: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pendientes[rid] = fut
        await self._ws.send(json.dumps({"jsonrpc": "2.0", "id": rid, "method": metodo,
                                        "params": params or {}}))
        try:
            msg = await asyncio.wait_for(fut, self.timeout)
        except TimeoutError:
            raise FuenteError("CORTEX_NO_DISPONIBLE", f"Cortex no respondió a {metodo}") from None
        finally:
            self._pendientes.pop(rid, None)
        if "error" in msg:
            raise _error_cortex(metodo, msg["error"])
        return msg.get("result")

    async def _leer(self) -> None:
        try:
            async for raw in self._ws:
                msg = json.loads(raw)
                fut = self._pendientes.get(msg.get("id")) if "id" in msg else None
                if fut is not None:
                    # Las columnas se registran ya: Cortex envía datos justo tras suscribir.
                    res = msg.get("result")
                    for ok in res.get("success", []) if isinstance(res, dict) else []:
                        if "cols" in ok:
                            self._cols[ok["streamName"]] = ok["cols"]
                    if not fut.done():
                        fut.set_result(msg)
                    continue
                for stream, cols in self._cols.items():
                    if stream in msg:
                        m = convertir(stream, cols, msg[stream], float(msg.get("time", 0)))
                        if m is not None:
                            if self._cola.full():  # el consumidor va lento: se pierde la más vieja
                                self._cola.get_nowait()
                            self._cola.put_nowait(m)
        except websockets.ConnectionClosed:
            pass
        finally:
            for fut in self._pendientes.values():
                if not fut.done():
                    fut.set_exception(
                        FuenteError("CORTEX_NO_DISPONIBLE", "Cortex cerró la conexión"))
            await self._cola.put(None)

    # ---------------------------------------------------------------- Fuente
    async def abrir(self) -> str:
        try:
            self._ws = await websockets.connect(self.url, ssl=_ssl(self.url), max_size=None,
                                                open_timeout=self.timeout)
        except (OSError, TimeoutError, websockets.InvalidHandshake) as e:
            raise FuenteError("CORTEX_NO_DISPONIBLE", f"No se pudo conectar a Cortex ({e}). "
                                                      "¿Está abierto el EMOTIV Launcher?") from None
        self._lector = asyncio.create_task(self._leer())
        cred = {"clientId": self.client_id, "clientSecret": self.client_secret}
        acceso = await self._llamar("requestAccess", cred)
        if not acceso.get("accessGranted"):
            raise FuenteError("APP_NO_APROBADA", "Aprueba NeuroAcceso en el EMOTIV Launcher")
        self.token = (await self._llamar("authorize", cred))["cortexToken"]
        self.casco = await self._casco()
        sesion = await self._llamar("createSession", {"cortexToken": self.token,
                                                      "headset": self.casco, "status": "active"})
        self.sesion = (sesion or {}).get("id") or await self._buscar_sesion()
        await self._llamar("subscribe", {"cortexToken": self.token, "session": self.sesion,
                                               "streams": STREAMS})
        if "mot" not in self._cols and "fac" not in self._cols:
            raise FuenteError("SIN_CASCO", "No se pudo suscribir a los datos del casco")
        return self.casco

    async def _casco(self) -> str:
        cascos = await self._llamar("queryHeadsets")
        if not cascos:
            await self._llamar("controlDevice", {"command": "refresh"})
            await asyncio.sleep(3)
            cascos = await self._llamar("queryHeadsets")
        if not cascos:
            raise FuenteError("SIN_CASCO", "No se encontró el casco: enciéndelo y desconecta el "
                                           "cable de carga")
        casco = cascos[0]
        if casco.get("status") != "connected":
            await self._llamar("controlDevice", {"command": "connect", "headset": casco["id"]})
            for _ in range(30):
                await asyncio.sleep(1)
                estado = {h["id"]: h for h in await self._llamar("queryHeadsets")}
                if estado.get(casco["id"], {}).get("status") == "connected":
                    break
            else:
                raise FuenteError("SIN_CASCO", f"El casco {casco['id']} no terminó de conectarse")
        return str(casco["id"])

    async def _buscar_sesion(self) -> str:
        for s in await self._llamar("querySessions", {"cortexToken": self.token}):
            if s.get("headset", {}).get("id") == self.casco:
                return str(s["id"])
        raise FuenteError("SIN_CASCO", "No se encontró la sesión creada")

    async def muestras(self) -> AsyncIterator[Muestra]:
        while True:
            m = await self._cola.get()
            if m is None:
                raise FuenteError("CASCO_DESCONECTADO", "Se perdió la conexión con Cortex")
            yield m

    async def cargar_perfil(self, nombre: str) -> None:
        perfiles = await self._llamar("queryProfile", {"cortexToken": self.token})
        existe = any(p.get("name") == nombre for p in perfiles or [])
        await self._llamar("setupProfile", {"cortexToken": self.token, "headset": self.casco,
                                            "profile": nombre,
                                            "status": "load" if existe else "create"})
        if not existe:
            await self._llamar("setupProfile", {"cortexToken": self.token, "headset": self.casco,
                                                "profile": nombre, "status": "load"})

    async def entrenar(self, deteccion: Deteccion, accion: str, estado: EstadoEntreno) -> None:
        await self._llamar("training", {"cortexToken": self.token, "session": self.sesion,
                                        "detection": deteccion, "action": accion,
                                        "status": estado})

    async def cerrar(self) -> None:
        if self._ws is not None:
            await self._ws.close()
        if self._lector is not None:
            self._lector.cancel()
