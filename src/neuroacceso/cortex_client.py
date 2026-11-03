"""Cliente mínimo para la Emotiv Cortex API (JSON-RPC 2.0 sobre WebSocket).

Documentación oficial: https://emotiv.gitbook.io/cortex-api
"""

from __future__ import annotations

import itertools
import json
import logging
import queue
import ssl
import threading
import time
from typing import Any, Callable

import websocket  # paquete "websocket-client"

log = logging.getLogger(__name__)

CORTEX_URL = "wss://localhost:6868"

Callback = Callable[[dict[str, Any], float], None]


class CortexError(RuntimeError):
    """Error devuelto por Cortex o problema en la secuencia de conexión."""


class CortexClient:
    def __init__(self, client_id: str, client_secret: str, url: str = CORTEX_URL):
        if not client_id or not client_secret:
            raise CortexError(
                "Faltan EMOTIV_CLIENT_ID / EMOTIV_CLIENT_SECRET. Revisa el archivo .env "
                "(ver docs/guia-inicio.md)."
            )
        self.client_id = client_id
        self.client_secret = client_secret
        self.url = url
        self.token: str | None = None
        self.session_id: str | None = None
        self.headset_id: str | None = None

        self._ids = itertools.count(1)
        self._pending: dict[int, queue.Queue] = {}
        self._cols: dict[str, list] = {}
        self._callbacks: dict[str, list[Callback]] = {}
        self._opened = threading.Event()
        self._ws: websocket.WebSocketApp | None = None

    # ------------------------------------------------------------------ conexión
    def conectar(self, timeout: float = 10) -> None:
        self._ws = websocket.WebSocketApp(
            self.url,
            on_open=lambda ws: self._opened.set(),
            on_message=self._on_message,
            on_error=lambda ws, err: log.error("WebSocket: %s", err),
            on_close=lambda ws, code, msg: log.info("Conexión con Cortex cerrada"),
        )
        # Cortex usa un certificado autofirmado en localhost.
        hilo = threading.Thread(
            target=self._ws.run_forever,
            kwargs={"sslopt": {"cert_reqs": ssl.CERT_NONE}},
            daemon=True,
        )
        hilo.start()
        if not self._opened.wait(timeout):
            raise CortexError(
                "No se pudo conectar a Cortex en %s. ¿Está abierto el EMOTIV Launcher?" % self.url
            )

    def cerrar(self) -> None:
        if self._ws:
            self._ws.close()

    # -------------------------------------------------------------- JSON-RPC
    def call(self, method: str, params: dict | None = None, timeout: float = 15) -> Any:
        if not self._ws:
            raise CortexError("Primero llama a conectar()")
        req_id = next(self._ids)
        respuesta: queue.Queue = queue.Queue(maxsize=1)
        self._pending[req_id] = respuesta
        self._ws.send(
            json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        )
        try:
            msg = respuesta.get(timeout=timeout)
        except queue.Empty:
            raise CortexError(f"Cortex no respondió a '{method}'") from None
        finally:
            self._pending.pop(req_id, None)
        if "error" in msg:
            err = msg["error"]
            raise CortexError(f"{method}: {err.get('message')} (código {err.get('code')})")
        return msg.get("result")

    # -------------------------------------------------------------- streams
    def on(self, stream: str, callback: Callback) -> None:
        """Registra una función que recibe cada muestra del stream como dict."""
        self._callbacks.setdefault(stream, []).append(callback)

    def _on_message(self, ws, raw: str) -> None:
        msg = json.loads(raw)

        if "id" in msg and msg["id"] in self._pending:
            self._pending[msg["id"]].put(msg)
            return

        if "warning" in msg:
            log.warning("Cortex: %s", msg["warning"])
            return

        for stream, callbacks in self._callbacks.items():
            if stream in msg and stream in self._cols:
                muestra = self._a_dict(self._cols[stream], msg[stream])
                for cb in callbacks:
                    try:
                        cb(muestra, msg.get("time", time.time()))
                    except Exception:  # un error en un callback no debe cortar el stream
                        log.exception("Error procesando muestra de '%s'", stream)

    @staticmethod
    def _a_dict(cols: list, valores: list) -> dict[str, Any]:
        """Une nombres de columna y valores. En 'dev' una columna es a su vez una lista
        (calidad de contacto por sensor); se guarda bajo la clave 'contacto'."""
        out: dict[str, Any] = {}
        for col, val in zip(cols, valores):
            if isinstance(col, list):
                out["contacto"] = dict(zip(col, val)) if isinstance(val, list) else val
            else:
                out[col] = val
        return out

    # -------------------------------------------------------- secuencia completa
    def iniciar(self, streams: list[str]) -> None:
        """requestAccess → authorize → casco → createSession → subscribe."""
        self.conectar()

        acceso = self.call(
            "requestAccess", {"clientId": self.client_id, "clientSecret": self.client_secret}
        )
        if not acceso.get("accessGranted"):
            raise CortexError(
                "La aplicación aún no está aprobada. Apruébala en el EMOTIV Launcher "
                "y vuelve a ejecutar."
            )

        auth = self.call(
            "authorize", {"clientId": self.client_id, "clientSecret": self.client_secret}
        )
        self.token = auth["cortexToken"]
        if auth.get("warning"):
            log.warning("authorize: %s", auth["warning"])

        self.headset_id = self._obtener_casco()
        log.info("Casco conectado: %s", self.headset_id)

        sesion = self.call(
            "createSession",
            {"cortexToken": self.token, "headset": self.headset_id, "status": "active"},
        )
        self.session_id = (sesion or {}).get("id") or self._buscar_sesion()

        resultado = self.call(
            "subscribe",
            {"cortexToken": self.token, "session": self.session_id, "streams": streams},
        )
        for ok in resultado.get("success", []):
            self._cols[ok["streamName"]] = ok["cols"]
            log.info("Suscrito a '%s': %s", ok["streamName"], ok["cols"])
        for fallo in resultado.get("failure", []):
            log.warning("No se pudo suscribir a '%s': %s", fallo["streamName"], fallo["message"])
        if not self._cols:
            raise CortexError("No se pudo suscribir a ningún stream")

    def _obtener_casco(self, espera_s: float = 30) -> str:
        cascos = self.call("queryHeadsets")
        if not cascos:
            self.call("controlDevice", {"command": "refresh"})
            time.sleep(3)
            cascos = self.call("queryHeadsets")
        if not cascos:
            raise CortexError(
                "No se encontró ningún casco. Enciéndelo, revisa Bluetooth/receptor USB "
                "y desconecta el cable de carga."
            )
        casco = cascos[0]
        if casco.get("status") != "connected":
            self.call("controlDevice", {"command": "connect", "headset": casco["id"]})
            limite = time.time() + espera_s
            while time.time() < limite:
                time.sleep(1)
                estado = {h["id"]: h for h in self.call("queryHeadsets")}
                if estado.get(casco["id"], {}).get("status") == "connected":
                    break
            else:
                raise CortexError(f"El casco {casco['id']} no terminó de conectarse")
        return casco["id"]

    def _buscar_sesion(self) -> str:
        for s in self.call("querySessions", {"cortexToken": self.token}):
            if s.get("headset", {}).get("id") == self.headset_id:
                return s["id"]
        raise CortexError("No se encontró la sesión creada")

    # ------------------------------------------------------------ utilidades
    def info_deteccion(self, deteccion: str = "facialExpression") -> Any:
        """Lista de acciones posibles: 'facialExpression' o 'mentalCommand'."""
        return self.call("getDetectionInfo", {"detection": deteccion})
