"""Núcleo del motor: conexión con la fuente, procesamiento, máquina de modos y acciones.

Todo corre en el bucle asyncio; solo el actuador del ratón usa su propio hilo.
"""

import asyncio
import logging
import time
import uuid
from collections.abc import Callable

from pydantic import BaseModel

from . import __version__
from .actuadores import Boton, Raton
from .contrato import (
    Accion,
    Ajustes,
    CodigoError,
    Conexion,
    Estado,
    EvAccion,
    EvAjustes,
    EvCalibracion,
    EvConexion,
    EvDispositivo,
    EvEntrada,
    EvEntrenamiento,
    EvError,
    EvGesto,
    EvHola,
    EvModo,
    EvOrientacion,
    Latencia,
    Modo,
    OrigenAccion,
)
from .datos import Datos
from .eventos import Hub
from .fuentes.base import (
    Dispositivo,
    Facial,
    Fuente,
    FuenteError,
    Mental,
    Movimiento,
    Muestra,
    Sistema,
)
from .procesamiento import Cursor, Gesto, Permanencia, detectar

log = logging.getLogger(__name__)

CLICS: set[Accion] = {"clic", "clic_derecho", "doble_clic"}
MODOS_USUARIO: set[Modo] = {"cursor", "comunicador", "pausa"}
TIMEOUT_CALIBRACION_S = 20
REINTENTO_MAX_S = 30
FASES_SYS = {"Started": "iniciado", "Succeeded": "exito", "Failed": "fallo",
             "Completed": "guardado", "Rejected": "rechazado"}


class ModoInvalido(Exception):
    pass


class Motor:
    def __init__(self, crear_fuente: Callable[[], Fuente], raton: Raton, datos: Datos, hub: Hub):
        self.crear_fuente = crear_fuente
        self.raton = raton
        self.datos = datos
        self.hub = hub
        self.estado = Estado()
        self.fuente: Fuente | None = None
        self.ajustes = Ajustes()
        self.estado.perfil_activo_id = datos.perfil_activo()
        if self.estado.perfil_activo_id:
            self.ajustes = datos.ajustes(self.estado.perfil_activo_id) or Ajustes()
        self.cursor = Cursor(self.ajustes.cursor)
        self.permanencia = Permanencia(self.ajustes.dwell)
        self._ultima_accion = 0.0
        # Por canal: las muestras faciales y mentales llegan intercaladas y no deben pisarse.
        self._ultimo_crudo: dict[str, str | None] = {"facial": None, "mental": None}
        self._disparado: dict[str, bool] = {"facial": False, "mental": False}
        self._ult_orient = 0.0
        self._ult_calib = 0.0
        self._calib_desde = 0.0
        self._modo_previo: Modo = "cursor"
        self._entreno: EvEntrenamiento | None = None
        self._tarea: asyncio.Task[None] | None = None

    # ================================================================ eventos
    def publicar(self, tipo: str, datos: BaseModel) -> None:
        self.hub.publicar(tipo, datos)

    def hola(self) -> EvHola:
        return EvHola(version=__version__, estado=self.estado_actual(), ajustes=self.ajustes)

    def estado_actual(self) -> Estado:
        p50, p95 = self.raton.latencia_ms()
        self.estado.latencia_ms = Latencia(p50=round(p50, 2), p95=round(p95, 2))
        return self.estado.model_copy(deep=True)

    def _error(self, codigo: CodigoError, mensaje: str, recuperable: bool = True) -> None:
        self.publicar("error", EvError(codigo=codigo, mensaje=mensaje, recuperable=recuperable))

    # ============================================================== conexión
    def conectar(self) -> None:
        if self._tarea is None or self._tarea.done():
            self._tarea = asyncio.create_task(self._ciclo())

    async def desconectar(self) -> None:
        if self._tarea is not None:
            self._tarea.cancel()
            try:
                await self._tarea
            except asyncio.CancelledError:
                pass
            self._tarea = None
        self._conexion(Conexion(estado="desconectado"))
        self._fijar_modo("desconectado", "conexion")

    def _conexion(self, c: Conexion, codigo: CodigoError | None = None) -> None:
        self.estado.conexion = c
        self.publicar("conexion", EvConexion(**c.model_dump(), codigo=codigo))

    async def _ciclo(self) -> None:
        espera = 1.0
        while True:
            self._conexion(Conexion(estado="conectando"))
            fuente = None
            try:
                fuente = self.crear_fuente()
                casco = await fuente.abrir()
                self.fuente, espera = fuente, 1.0
                self._conexion(Conexion(estado="conectado", casco_id=casco))
                perfil = self.datos.perfil(self.estado.perfil_activo_id or "")
                if perfil and perfil.cortex_profile:
                    await fuente.cargar_perfil(perfil.cortex_profile)
                self.iniciar_calibracion()
                async for m in fuente.muestras():
                    self.procesar(m)
                raise FuenteError("CASCO_DESCONECTADO", "La fuente terminó")
            except FuenteError as e:
                log.warning("Fuente: %s", e.mensaje)
                self._conexion(Conexion(estado="error", detalle=e.mensaje), e.codigo)
                self._error(e.codigo, e.mensaje)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 — el motor debe sobrevivir y reintentar
                log.exception("Error inesperado en la fuente")
                self._conexion(Conexion(estado="error", detalle=str(e)), "CORTEX_NO_DISPONIBLE")
                self._error("CORTEX_NO_DISPONIBLE", f"Error inesperado: {e}")
            finally:
                self.fuente = None
                self.cursor.cancelar()
                self._fijar_modo("desconectado", "conexion")
                if fuente is not None:
                    try:
                        await fuente.cerrar()
                    except Exception:  # noqa: BLE001
                        log.debug("Error al cerrar la fuente", exc_info=True)
            await asyncio.sleep(espera)
            espera = min(espera * 2, REINTENTO_MAX_S)

    # ============================================================ muestras
    def procesar(self, m: Muestra) -> None:
        if isinstance(m, Movimiento):
            self._movimiento(m)
        elif isinstance(m, Facial | Mental):
            self._gesto(m)
        elif isinstance(m, Dispositivo):
            self.publicar("dispositivo", EvDispositivo(
                bateria_pct=max(0, min(100, m.bateria_pct)), senal=m.senal,
                contacto=m.contacto, calidad_global=max(0, min(100, m.calidad_global))))
        elif isinstance(m, Sistema):
            self._sistema(m)

    def _movimiento(self, m: Movimiento) -> None:
        estaba_calibrando = self.cursor.calibrando
        d = self.cursor.procesar(m)
        ahora = time.monotonic()
        if estaba_calibrando:
            self._progreso_calibracion(ahora)
            return
        if ahora - self._ult_orient >= 0.05:  # ≤ 20 Hz hacia la interfaz
            self._ult_orient = ahora
            yaw, pitch = self.cursor.orientacion
            self.publicar("orientacion", EvOrientacion(yaw=round(yaw, 2), pitch=round(pitch, 2),
                                                       calibrado=self.estado.calibrado))
        if self.estado.modo != "cursor":
            return
        if d:
            self.raton.mover(d[0], d[1], m.rx)
        if self.ajustes.dwell.activo and self.permanencia.actualizar(*(d or (0.0, 0.0)), ahora):
            self._ejecutar("clic", OrigenAccion(tipo="dwell", nombre="permanencia"), m.rx)

    def _gesto(self, m: Facial | Mental) -> None:
        canal = "mental" if isinstance(m, Mental) else "facial"
        g = detectar(m)
        clave = g.gesto if g else None
        if clave != self._ultimo_crudo[canal]:
            self._ultimo_crudo[canal], self._disparado[canal] = clave, False
            if g:
                self.publicar("gesto", EvGesto(gesto=g.gesto, zona=g.zona,  # type: ignore[arg-type]
                                               potencia=round(g.potencia, 3)))
        # Un gesto sostenido dispara una sola vez: al superar el umbral por primera vez.
        if g is None or self._disparado[canal]:
            return
        if g.zona != "ojos" and g.potencia < self.ajustes.gestos.umbral:
            return
        self._disparado[canal] = True
        self._decidir(g, m.rx)

    def _decidir(self, g: Gesto, rx: float) -> None:
        a = self.ajustes.gestos
        modo = self.estado.modo
        if modo not in MODOS_USUARIO:
            return
        origen = OrigenAccion(tipo="mental" if g.zona == "mental" else "gesto", nombre=g.gesto)
        if g.gesto == a.gesto_rescate:
            if self._antirrebote():
                self.cambiar_modo("comunicador" if modo != "comunicador" else "cursor",
                                  "gesto_rescate")
            return
        mapeo = a.mapeo.comunicador if modo == "comunicador" else a.mapeo.cursor
        accion = mapeo.get(g.gesto)
        if accion is None:
            return
        if not self._antirrebote():
            self.publicar("accion", EvAccion(accion=accion, origen=origen, modo=modo,
                                             ejecutada=False, motivo="cooldown"))
            return
        self._ejecutar(accion, origen, rx)

    def _antirrebote(self) -> bool:
        ahora = time.monotonic()
        if (ahora - self._ultima_accion) * 1000 < self.ajustes.gestos.cooldown_ms:
            return False
        self._ultima_accion = ahora
        return True

    def _ejecutar(self, accion: Accion, origen: OrigenAccion, rx: float) -> None:
        modo = self.estado.modo
        ejecutada, motivo = True, None
        if accion == "pausar":
            if modo == "comunicador":
                ejecutada = False
            else:
                self.cambiar_modo("cursor" if modo == "pausa" else "pausa", "usuario")
        elif accion == "cambiar_modo":
            self.cambiar_modo("comunicador" if modo != "comunicador" else "cursor", "usuario")
        elif modo == "pausa":
            ejecutada, motivo = False, "pausado"
        elif modo == "comunicador":
            if accion in ("seleccionar", "atras"):
                self.publicar("entrada", EvEntrada(accion=accion))  # type: ignore[arg-type]
            else:
                ejecutada = False  # en el comunicador el ratón no se toca
        elif accion in CLICS:
            boton: Boton = accion  # type: ignore[assignment]
            self.raton.clic(boton, rx)
        else:
            ejecutada = False
        self.publicar("accion", EvAccion(accion=accion, origen=origen, modo=modo,
                                         ejecutada=ejecutada, motivo=motivo))  # type: ignore[arg-type]

    # ================================================================ modos
    def _fijar_modo(self, modo: Modo, motivo: str) -> None:
        if self.estado.modo == modo:
            return
        self.estado.modo = modo
        self.estado.pausado = modo == "pausa"
        self.publicar("modo", EvModo(modo=modo, pausado=self.estado.pausado,
                                     motivo=motivo))  # type: ignore[arg-type]

    def cambiar_modo(self, modo: Modo, motivo: str = "usuario") -> None:
        if self.estado.modo == "entrenando" and modo in MODOS_USUARIO:
            self._cancelar_entreno()  # pedir otro modo cancela el entrenamiento en curso
        if modo not in MODOS_USUARIO or self.estado.modo not in MODOS_USUARIO:
            raise ModoInvalido(f"No se puede pasar de {self.estado.modo} a {modo}")
        self._fijar_modo(modo, motivo)

    def interfaz_desconectada(self) -> None:
        """Si se cierra la última interfaz en el comunicador, el usuario no queda atrapado."""
        if self.hub.n_clientes > 0:
            return
        if self.estado.modo == "entrenando":
            self._cancelar_entreno()
        if self.estado.modo == "comunicador":
            self._fijar_modo("cursor", "ui_desconectada")

    # =========================================================== calibración
    def iniciar_calibracion(self) -> None:
        if self.fuente is None:
            raise ModoInvalido("No hay casco conectado")
        if self.estado.modo in MODOS_USUARIO:
            self._modo_previo = self.estado.modo
        self.cursor.calibrar()
        self._calib_desde = time.monotonic()
        self._fijar_modo("calibrando", "calibracion")
        self.publicar("calibracion", EvCalibracion(estado="en_curso", progreso=0,
                                                   instruccion="Mira al centro y no te muevas"))

    def cancelar_calibracion(self) -> None:
        if not self.cursor.calibrando:
            return
        self.cursor.cancelar()
        self.publicar("calibracion", EvCalibracion(estado="cancelada", progreso=0,
                                                   instruccion="Calibración cancelada"))
        self._salir_calibracion()

    def _salir_calibracion(self) -> None:
        # Sin un centro previo no se puede mover el cursor: queda en pausa hasta calibrar.
        destino = self._modo_previo if self.estado.calibrado else "pausa"
        self._fijar_modo(destino, "calibracion")

    def _progreso_calibracion(self, ahora: float) -> None:
        if not self.cursor.calibrando:  # acaba de terminar
            self.estado.calibrado = True
            self.publicar("calibracion", EvCalibracion(estado="completada", progreso=1,
                                                       instruccion="Calibración completada"))
            self._salir_calibracion()
            return
        if ahora - self._calib_desde > TIMEOUT_CALIBRACION_S:
            self.cursor.cancelar()
            self.publicar("calibracion", EvCalibracion(
                estado="fallida", progreso=0,
                instruccion="No se pudo calibrar: mantén la cabeza quieta e inténtalo de nuevo"))
            self._salir_calibracion()
            return
        if ahora - self._ult_calib >= 0.2:  # ~5 Hz
            self._ult_calib = ahora
            texto = ("Te moviste: vuelve a mirar al centro y quédate quieto"
                     if self.cursor.inestable else "Mira al centro y no te muevas")
            self.publicar("calibracion", EvCalibracion(estado="en_curso",
                                                       progreso=round(self.cursor.progreso, 2),
                                                       instruccion=texto))

    # ============================================================== ajustes
    def aplicar_ajustes(self, perfil_id: str, ajustes: Ajustes) -> None:
        self.ajustes = ajustes
        self.cursor.ajustes = ajustes.cursor
        self.permanencia.ajustes = ajustes.dwell
        self.publicar("ajustes", EvAjustes(perfil_id=perfil_id, ajustes=ajustes))

    async def activar_perfil(self, perfil_id: str) -> None:
        ajustes = self.datos.ajustes(perfil_id)
        if ajustes is None:
            raise KeyError(perfil_id)
        self.datos.activar(perfil_id)
        self.estado.perfil_activo_id = perfil_id
        self.aplicar_ajustes(perfil_id, ajustes)
        perfil = self.datos.perfil(perfil_id)
        if self.fuente is not None and perfil and perfil.cortex_profile:
            await self.fuente.cargar_perfil(perfil.cortex_profile)

    # ========================================================= entrenamiento
    async def entrenar(self, deteccion: str, accion: str) -> str:
        if self.fuente is None:
            raise ModoInvalido("No hay casco conectado")
        if self.estado.modo not in MODOS_USUARIO:
            raise ModoInvalido(f"No se puede entrenar en modo {self.estado.modo}")
        self._modo_previo = self.estado.modo
        self._entreno = EvEntrenamiento(fase="iniciado", deteccion=deteccion,  # type: ignore[arg-type]
                                        accion=accion)
        self._fijar_modo("entrenando", "entrenamiento")
        try:
            await self.fuente.entrenar(self._deteccion_cortex(), accion, "start")
        except Exception:
            self._terminar_entreno()
            raise
        return uuid.uuid4().hex[:12]

    def _terminar_entreno(self) -> None:
        self._entreno = None
        if self.estado.modo == "entrenando":
            self._fijar_modo(self._modo_previo, "entrenamiento")

    def _cancelar_entreno(self) -> None:
        """Salida de emergencia: avisa a Cortex sin esperar y vuelve al modo previo."""
        if self._entreno is not None and self.fuente is not None:
            tarea = asyncio.ensure_future(self.fuente.entrenar(
                self._deteccion_cortex(), self._entreno.accion, "reject"))
            tarea.add_done_callback(lambda t: t.cancelled() or t.exception())
        self._terminar_entreno()

    async def responder_entrenamiento(self, aceptar: bool) -> None:
        if self.fuente is None or self._entreno is None:
            raise ModoInvalido("No hay un entrenamiento en curso")
        await self.fuente.entrenar(self._deteccion_cortex(), self._entreno.accion,
                                   "accept" if aceptar else "reject")

    def _deteccion_cortex(self):  # type: ignore[no-untyped-def]
        assert self._entreno is not None
        return "mentalCommand" if self._entreno.deteccion == "mental" else "facialExpression"

    def _sistema(self, m: Sistema) -> None:
        fase = FASES_SYS.get(m.evento.split("_", 1)[-1])
        if self._entreno is None or fase is None:
            return
        self._entreno = self._entreno.model_copy(update={"fase": fase})
        self.publicar("entrenamiento", self._entreno)
        if fase in ("guardado", "fallo", "rechazado"):
            self._terminar_entreno()
