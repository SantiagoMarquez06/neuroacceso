"""Simulador de Emotiv Cortex: permite hacer demos y desarrollar SIN el casco.

Levanta un servidor WebSocket que habla el mismo protocolo JSON-RPC que el servicio
Cortex del EMOTIV Launcher (requestAccess, authorize, queryHeadsets, createSession,
subscribe…) y emite los streams fac, mot, dev y com de un "EPOC X simulado".

Controles (globales, funcionan aunque la ventana no tenga el foco; F8 los activa/desactiva):
    Flechas  → girar la cabeza          C → apretar mandíbula (clench)
    Q        → guiño izquierdo (winkL)  E → guiño derecho (winkR)
    B        → parpadeo (blink)         S → sonrisa (smile)
    P        → comando mental "push"    R → volver a mirar al frente

Uso:
    python -m neuroacceso.simulador            # con panel de control
    python -m neuroacceso.simulador --sin-panel
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import random
import threading
import time

PUERTO = 6870
HEADSET_ID = "EPOCX-SIMULADO"
SENSORES = ["AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", "P8", "T8", "FC6", "F4", "F8", "AF4"]

COLS = {
    "fac": ["eyeAct", "uAct", "uPow", "lAct", "lPow"],
    "mot": ["COUNTER_MEMS", "INTERPOLATED_MEMS", "Q0", "Q1", "Q2", "Q3",
            "ACCX", "ACCY", "ACCZ", "MAGX", "MAGY", "MAGZ"],
    "dev": ["Battery", "Signal", SENSORES + ["OVERALL"], "BatteryPercent"],
    "com": ["act", "pow"],
}
HZ = {"mot": 32, "fac": 8, "dev": 2, "com": 8}
TICK_HZ = 32

# gesto → (zona, duración en s)
GESTOS = {
    "clench": ("lower", 0.4), "smile": ("lower", 0.4), "laugh": ("lower", 0.4),
    "smirkLeft": ("lower", 0.4), "smirkRight": ("lower", 0.4),
    "surprise": ("upper", 0.4), "frown": ("upper", 0.4),
    "blink": ("eye", 0.25), "winkL": ("eye", 0.3), "winkR": ("eye", 0.3),
    "lookL": ("eye", 0.3), "lookR": ("eye", 0.3),
    "push": ("com", 0.6),
}
TECLAS = {"c": "clench", "q": "winkL", "e": "winkR", "b": "blink", "s": "smile", "p": "push"}

VEL_GIRO = 18.0  # grados por segundo al mantener una flecha


def yaw_pitch_a_cuaternion(yaw: float, pitch: float) -> tuple[float, float, float, float]:
    """Rotación yaw (eje Z) seguida de pitch (eje Y), en grados → (w, x, y, z)."""
    y, p = math.radians(yaw) / 2, math.radians(pitch) / 2
    return (math.cos(y) * math.cos(p), -math.sin(y) * math.sin(p),
            math.cos(y) * math.sin(p), math.sin(y) * math.cos(p))


class EstadoCasco:
    """Estado del casco simulado. Se modifica desde el panel y se lee desde el servidor."""

    def __init__(self):
        self.yaw = 0.0
        self.pitch = 0.0
        self.direcciones: set[str] = set()  # "izq", "der", "arriba", "abajo"
        self.gesto: str | None = None
        self.gesto_hasta = 0.0
        self.mal_contacto = False
        self.bateria = 87.0
        self.clientes = 0
        self.ultimo_gesto = "—"
        self._contador = 0

    def disparar(self, gesto: str) -> None:
        if gesto not in GESTOS:
            raise ValueError(f"gesto desconocido: {gesto}")
        self.gesto = gesto
        self.gesto_hasta = time.monotonic() + GESTOS[gesto][1]
        self.ultimo_gesto = gesto

    def recentrar(self) -> None:
        self.yaw = self.pitch = 0.0

    def tick(self, dt: float) -> None:
        v = VEL_GIRO * dt
        if "izq" in self.direcciones:
            self.yaw += v
        if "der" in self.direcciones:
            self.yaw -= v
        if "arriba" in self.direcciones:
            self.pitch += v
        if "abajo" in self.direcciones:
            self.pitch -= v
        self.pitch = max(-60.0, min(60.0, self.pitch))
        self.bateria = max(5.0, self.bateria - dt * 0.002)

    def _gesto_activo(self, zona: str) -> str | None:
        if self.gesto and time.monotonic() < self.gesto_hasta and GESTOS[self.gesto][0] == zona:
            return self.gesto
        return None

    # --------------------------------------------------------------- muestras
    def muestra(self, stream: str) -> list:
        return getattr(self, "_" + stream)()

    def _mot(self) -> list:
        self._contador = (self._contador + 1) % 128
        ruido = lambda: random.uniform(-0.03, 0.03)  # micro-temblor de la cabeza
        q = yaw_pitch_a_cuaternion(self.yaw + ruido(), self.pitch + ruido())
        acc = [round(random.gauss(0, 0.01), 4), round(random.gauss(0, 0.01), 4),
               round(1 + random.gauss(0, 0.01), 4)]
        mag = [round(random.gauss(m, 0.5), 2) for m in (-12.0, 30.0, -40.0)]
        return [self._contador, 0, *[round(c, 6) for c in q], *acc, *mag]

    def _fac(self) -> list:
        ojo = self._gesto_activo("eye") or "neutral"
        sup = self._gesto_activo("upper")
        inf = self._gesto_activo("lower")
        return [ojo,
                sup or "neutral", round(random.uniform(0.7, 0.95), 3) if sup else 0,
                inf or "neutral", round(random.uniform(0.7, 0.95), 3) if inf else 0]

    def _com(self) -> list:
        cmd = self._gesto_activo("com")
        return [cmd, round(random.uniform(0.6, 0.9), 3)] if cmd else ["neutral", 0]

    def _dev(self) -> list:
        calidad = []
        for s in SENSORES:
            if self.mal_contacto and s in ("T7", "P7", "O1", "FC6"):
                calidad.append(random.choice([0, 1, 1, 2]))
            else:
                calidad.append(4 if random.random() > 0.05 else 3)
        overall = round(sum(calidad) / (4 * len(calidad)) * 100)
        bat = round(self.bateria)
        return [min(4, bat // 20), 1.0 if not self.mal_contacto else 0.8,
                calidad + [overall], bat]


# --------------------------------------------------------------------- servidor
class ServidorCortexSimulado:
    def __init__(self, estado: EstadoCasco, puerto: int = PUERTO):
        self.estado = estado
        self.puerto = puerto
        self.listo = threading.Event()
        self._loop: asyncio.AbstractEventLoop | None = None

    def iniciar_en_hilo(self) -> threading.Thread:
        hilo = threading.Thread(target=lambda: asyncio.run(self._main()), daemon=True)
        hilo.start()
        if not self.listo.wait(10):
            raise RuntimeError("El simulador no pudo arrancar")
        return hilo

    async def _main(self) -> None:
        from websockets.asyncio.server import serve

        self._loop = asyncio.get_running_loop()
        async with serve(self._conexion, "localhost", self.puerto):
            self.listo.set()
            ultimo = time.monotonic()
            while True:  # actualiza la física de la cabeza a 32 Hz
                await asyncio.sleep(1 / TICK_HZ)
                ahora = time.monotonic()
                self.estado.tick(ahora - ultimo)
                ultimo = ahora

    async def _conexion(self, ws) -> None:
        subs: dict[str, str] = {}
        self.estado.clientes += 1
        emisor = asyncio.create_task(self._emitir(ws, subs))
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                await ws.send(json.dumps(self._responder(msg, subs)))
        except Exception:
            pass  # cliente desconectado
        finally:
            emisor.cancel()
            self.estado.clientes -= 1

    async def _emitir(self, ws, subs: dict[str, str]) -> None:
        n = 0
        while True:
            await asyncio.sleep(1 / TICK_HZ)
            n += 1
            for stream, sid in list(subs.items()):
                if n % (TICK_HZ // HZ[stream]) == 0:
                    await ws.send(json.dumps(
                        {stream: self.estado.muestra(stream), "sid": sid, "time": time.time()}
                    ))

    def _responder(self, msg: dict, subs: dict[str, str]) -> dict:
        req_id, metodo, p = msg.get("id"), msg.get("method"), msg.get("params") or {}
        ok = lambda r: {"jsonrpc": "2.0", "id": req_id, "result": r}
        err = lambda c, m: {"jsonrpc": "2.0", "id": req_id, "error": {"code": c, "message": m}}

        if metodo == "requestAccess":
            return ok({"accessGranted": True, "message": "Simulador: acceso concedido"})
        if metodo == "authorize":
            return ok({"cortexToken": "token-simulado"})
        if metodo == "getCortexInfo":
            return ok({"version": "simulador-1.0"})
        if metodo == "queryHeadsets":
            return ok([{
                "id": HEADSET_ID, "status": "connected", "connectedBy": "dongle",
                "sensors": SENSORES, "motionSensors": COLS["mot"][2:],
                "settings": {"eegRate": 128, "memsRate": 32, "mode": "EPOCX"},
            }])
        if metodo == "controlDevice":
            return ok({"command": p.get("command"), "message": "ok"})
        if metodo == "createSession":
            return ok({"id": "sesion-simulada", "status": "activated", "headset": {"id": HEADSET_ID}})
        if metodo == "querySessions":
            return ok([{"id": "sesion-simulada", "headset": {"id": HEADSET_ID}}])
        if metodo == "updateSession":
            return ok({"id": "sesion-simulada", "status": p.get("status")})
        if metodo == "subscribe":
            exito, fallo = [], []
            for s in p.get("streams", []):
                if s in COLS:
                    subs[s] = f"sid-{s}"
                    exito.append({"streamName": s, "cols": COLS[s], "sid": subs[s]})
                elif s == "eeg":
                    fallo.append({"streamName": s, "code": -32016,
                                  "message": "The stream is unavailable or unsupported."})
                else:
                    fallo.append({"streamName": s, "code": -32016, "message": "No simulado"})
            return ok({"success": exito, "failure": fallo})
        if metodo == "unsubscribe":
            for s in p.get("streams", []):
                subs.pop(s, None)
            return ok({"success": [], "failure": []})
        if metodo == "getDetectionInfo":
            if p.get("detection") == "mentalCommand":
                return ok({"actions": ["neutral", "push", "pull", "lift", "drop", "left", "right"]})
            return ok({"actions": ["neutral", "blink", "winkL", "winkR", "lookL", "lookR",
                                   "surprise", "frown", "smile", "clench", "laugh",
                                   "smirkLeft", "smirkRight"]})
        # --- métodos extra del simulador (para pruebas automáticas y demos con guion)
        if metodo == "simularGesto":
            try:
                self.estado.disparar(p.get("gesto", ""))
            except ValueError as e:
                return err(-32602, str(e))
            return ok({"gesto": p["gesto"]})
        if metodo == "simularCabeza":
            self.estado.yaw = float(p.get("yaw", 0))
            self.estado.pitch = float(p.get("pitch", 0))
            return ok({"yaw": self.estado.yaw, "pitch": self.estado.pitch})
        if metodo == "simularContacto":
            self.estado.mal_contacto = bool(p.get("malo"))
            return ok({"mal_contacto": self.estado.mal_contacto})
        return err(-32601, f"Método no soportado por el simulador: {metodo}")


# ------------------------------------------------------------------------ panel
def _teclado_global(estado: EstadoCasco, activo: list[bool]):
    """Escucha el teclado aunque la ventana no tenga el foco (necesita pynput)."""
    try:
        from pynput import keyboard
    except ImportError:
        return None

    flechas = {keyboard.Key.left: "izq", keyboard.Key.right: "der",
               keyboard.Key.up: "arriba", keyboard.Key.down: "abajo"}
    pulsadas: set = set()

    def al_pulsar(k):
        if k == keyboard.Key.f8:
            activo[0] = not activo[0]
            estado.direcciones.clear()
            return
        if not activo[0] or k in pulsadas:
            return
        pulsadas.add(k)
        if k in flechas:
            estado.direcciones.add(flechas[k])
            return
        c = getattr(k, "char", None)
        c = c.lower() if c else None
        if c in TECLAS:
            estado.disparar(TECLAS[c])
        elif c == "r":
            estado.recentrar()

    def al_soltar(k):
        pulsadas.discard(k)
        if k in flechas:
            estado.direcciones.discard(flechas[k])

    listener = keyboard.Listener(on_press=al_pulsar, on_release=al_soltar)
    listener.daemon = True
    listener.start()
    return listener


def panel(estado: EstadoCasco, puerto: int) -> None:
    import tkinter as tk

    activo = [True]
    global_ok = _teclado_global(estado, activo) is not None

    root = tk.Tk()
    root.title("Simulador EPOC X")
    root.configure(bg="#101418")
    root.attributes("-topmost", True)
    root.geometry("+20+40")

    fg, tenue, acento = "#e8eaed", "#9aa0a6", "#f0a020"
    tk.Label(root, text="Simulador EPOC X", font=("Segoe UI", 15, "bold"),
             bg="#101418", fg=fg).pack(padx=16, pady=(12, 0), anchor="w")
    tk.Label(root, text=f"Cortex simulado en ws://localhost:{puerto}", font=("Segoe UI", 9),
             bg="#101418", fg=tenue).pack(padx=16, anchor="w")

    lbl_estado = tk.Label(root, font=("Consolas", 10), bg="#101418", fg=acento, justify="left")
    lbl_estado.pack(padx=16, pady=8, anchor="w")

    ayuda = ("Flechas  girar cabeza      R  mirar al frente\n"
             "C  apretar mandíbula       Q / E  guiño izq. / der.\n"
             "B  parpadeo   S  sonrisa   P  comando mental push\n"
             + ("F8  activar/desactivar teclado global" if global_ok
                else "(instala pynput para teclado global; ahora solo con esta ventana activa)"))
    tk.Label(root, text=ayuda, font=("Consolas", 9), bg="#101418", fg=tenue,
             justify="left").pack(padx=16, anchor="w")

    botones = tk.Frame(root, bg="#101418")
    botones.pack(padx=12, pady=10, anchor="w")
    for texto, gesto in [("Mandíbula", "clench"), ("Guiño izq.", "winkL"),
                         ("Guiño der.", "winkR"), ("Parpadeo", "blink"), ("Push", "push")]:
        tk.Button(botones, text=texto, command=lambda g=gesto: estado.disparar(g),
                  bg="#2a2e36", fg=fg, relief="flat", padx=8).pack(side="left", padx=3)

    var_contacto = tk.BooleanVar(value=False)
    tk.Checkbutton(root, text="Simular mal contacto (T7, P7, O1, FC6)", variable=var_contacto,
                   command=lambda: setattr(estado, "mal_contacto", var_contacto.get()),
                   bg="#101418", fg=fg, selectcolor="#2a2e36",
                   activebackground="#101418").pack(padx=14, pady=(0, 12), anchor="w")

    if not global_ok:  # sin pynput: teclas solo con la ventana enfocada
        flechas = {"Left": "izq", "Right": "der", "Up": "arriba", "Down": "abajo"}
        root.bind("<KeyPress>", lambda e: (estado.direcciones.add(flechas[e.keysym])
                                           if e.keysym in flechas else
                                           estado.disparar(TECLAS[e.char.lower()])
                                           if e.char and e.char.lower() in TECLAS else
                                           estado.recentrar() if e.char.lower() == "r" else None))
        root.bind("<KeyRelease>", lambda e: estado.direcciones.discard(flechas.get(e.keysym, "")))

    def refrescar():
        lbl_estado.config(text=(
            f"Clientes conectados: {estado.clientes}\n"
            f"Cabeza  yaw {estado.yaw:+6.1f}°  pitch {estado.pitch:+6.1f}°\n"
            f"Último gesto: {estado.ultimo_gesto}   Batería: {estado.bateria:.0f}%\n"
            f"Teclado global: {'ACTIVO' if activo[0] and global_ok else 'inactivo'}"
        ))
        root.after(100, refrescar)

    refrescar()
    root.mainloop()


def main() -> None:
    ap = argparse.ArgumentParser(description="Simulador de Emotiv Cortex")
    ap.add_argument("--puerto", type=int, default=PUERTO)
    ap.add_argument("--sin-panel", action="store_true")
    args = ap.parse_args()

    estado = EstadoCasco()
    ServidorCortexSimulado(estado, args.puerto).iniciar_en_hilo()
    print(f"Simulador de Cortex escuchando en ws://localhost:{args.puerto}")
    if args.sin_panel:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
    else:
        panel(estado, args.puerto)


if __name__ == "__main__":
    main()
