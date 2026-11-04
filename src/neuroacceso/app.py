"""Aplicación principal de NeuroAcceso: interfaz gráfica con todas las funciones.

Pestañas:
  1. Estado del casco   – conexión, batería, mapa de contacto, último gesto, registro.
  2. Práctica de puntería – objetivos en pantalla para medir el control con la cabeza.
  3. Comunicador        – teclado con barrido y voz (el cursor se bloquea aquí).
  4. Configuración      – sensibilidad, umbrales y mapeo de gestos en vivo.
"""

from __future__ import annotations

import queue
import random
import threading
import time
import tkinter as tk
from tkinter import ttk

import pyautogui

from . import config
from .comunicador import Comunicador
from .cortex_client import CortexClient, CortexError
from .gestos import DetectorGestos
from .head_mouse import HeadMouse, _diferencia_angular, cuaternion_a_yaw_pitch

C = {
    "fondo": "#14161a", "panel": "#1d2026", "borde": "#2a2e36", "texto": "#e8eaed",
    "tenue": "#9aa0a6", "acento": "#4f9cf0", "ok": "#3cb371", "alerta": "#e8892c",
    "error": "#d64545", "amarillo": "#f0a020",
}
CALIDAD = {0: ("#4a4d52", "Sin contacto"), 1: ("#d64545", "Malo"), 2: ("#e8892c", "Regular"),
           3: ("#d9c84a", "Bueno"), 4: ("#3cb371", "Excelente")}

# Posición aproximada de los sensores del EPOC X (vista superior, nariz arriba).
SENSORES_POS = {
    "AF3": (-0.25, 0.80), "AF4": (0.25, 0.80), "F7": (-0.70, 0.55), "F8": (0.70, 0.55),
    "F3": (-0.35, 0.55), "F4": (0.35, 0.55), "FC5": (-0.55, 0.28), "FC6": (0.55, 0.28),
    "T7": (-0.88, 0.0), "T8": (0.88, 0.0), "P7": (-0.70, -0.55), "P8": (0.70, -0.55),
    "O1": (-0.28, -0.86), "O2": (0.28, -0.86),
}
REFERENCIAS = {"CMS": (-0.40, -0.45), "DRL": (0.40, -0.45)}

NOMBRE_GESTO = {
    "clench": "Apretar mandíbula", "winkL": "Guiño izquierdo", "winkR": "Guiño derecho",
    "blink": "Parpadeo", "smile": "Sonrisa", "laugh": "Risa", "surprise": "Cejas arriba",
    "frown": "Ceño fruncido", "smirkLeft": "Media sonrisa izq.", "smirkRight": "Media sonrisa der.",
    "lookL": "Mirada izquierda", "lookR": "Mirada derecha", "push": "Comando mental: push",
}
NOMBRE_ACCION = {
    "clic": "Clic izquierdo", "clic_derecho": "Clic derecho", "doble_clic": "Doble clic",
    "pausar": "Pausar / reanudar cursor", "seleccionar": "Seleccionar",
}

TAB_ESTADO, TAB_PRACTICA, TAB_COMUNICADOR, TAB_CONFIG = range(4)


class App:
    def __init__(self, url: str, client_id: str, client_secret: str,
                 mover_raton: bool = True, etiqueta_fuente: str = ""):
        self.url = url
        self.root = tk.Tk()
        self.root.title("NeuroAcceso")
        sw, sh = self.root.winfo_screenwidth(), self.root.winfo_screenheight()
        w, h = min(1180, sw - 40), min(740, sh - 90)  # que quepa en pantallas de 1366×768
        self.root.geometry(f"{w}x{h}+{max(0, (sw - w) // 2)}+10")
        self.root.minsize(min(960, w), min(600, h))
        self.root.configure(bg=C["fondo"])

        self.ui_q: queue.Queue = queue.Queue()
        self.eventos_com: queue.Queue = queue.Queue()
        self.mouse = HeadMouse()
        self.var_mover = tk.BooleanVar(value=mover_raton)
        self.pausado = False
        self.tab = TAB_ESTADO
        self._ref_orient: tuple[float, float] | None = None
        self._ult_orient = 0.0
        self._ult_gesto_crudo: str | None = None

        self.det_cursor = DetectorGestos(config.MAPEO_GESTOS_CURSOR, self._accion_cursor)
        self.det_com = DetectorGestos(config.MAPEO_GESTOS_COMUNICADOR, self._accion_com)

        self._estilos()
        self._cabecera(etiqueta_fuente)
        self.nb = ttk.Notebook(self.root)
        self.nb.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self._tab_estado()
        self._tab_practica()
        self._tab_comunicador()
        self._tab_config()
        self.nb.bind("<<NotebookTabChanged>>", self._cambio_tab)
        self._actualizar_mouse()

        self.cortex: CortexClient | None = None
        try:
            self.cortex = CortexClient(client_id, client_secret, url=url)
            self.cortex.on("mot", self._on_mot)
            self.cortex.on("fac", self._on_fac)
            self.cortex.on("dev", self._on_dev)
            self.cortex.al_desconectar = lambda: self.ui_q.put(
                ("conexion", "error", "Se perdió la conexión con Cortex (¿se cerró el Launcher "
                                      "o el simulador?)"))
            threading.Thread(target=self._conectar, daemon=True).start()
        except CortexError as e:
            self._estado_conexion("error", str(e))

        self.root.after(50, self._procesar_ui)
        self.root.protocol("WM_DELETE_WINDOW", self.cerrar)

    # ================================================================ estilo
    def _estilos(self) -> None:
        st = ttk.Style(self.root)
        st.theme_use("clam")
        st.configure("TNotebook", background=C["fondo"], borderwidth=0)
        st.configure("TNotebook.Tab", background=C["panel"], foreground=C["tenue"],
                     padding=(18, 8), font=("Segoe UI", 11), borderwidth=0)
        st.map("TNotebook.Tab", background=[("selected", C["borde"])],
               foreground=[("selected", C["texto"])])
        st.configure("TFrame", background=C["fondo"])
        st.configure("Horizontal.TScale", background=C["panel"], troughcolor=C["borde"])

    def _tarjeta(self, padre, titulo: str) -> tk.Frame:
        marco = tk.Frame(padre, bg=C["panel"], highlightbackground=C["borde"],
                         highlightthickness=1)
        tk.Label(marco, text=titulo.upper(), bg=C["panel"], fg=C["tenue"],
                 font=("Segoe UI", 9, "bold")).pack(anchor="w", padx=14, pady=(10, 4))
        return marco

    def _lbl(self, padre, texto="", tam=11, color=None, negrita=False, **kw) -> tk.Label:
        return tk.Label(padre, text=texto, bg=padre["bg"], fg=color or C["texto"],
                        font=("Segoe UI", tam, "bold" if negrita else "normal"), **kw)

    # ============================================================== cabecera
    def _cabecera(self, etiqueta_fuente: str) -> None:
        cab = tk.Frame(self.root, bg=C["fondo"])
        cab.pack(fill="x", padx=16, pady=(12, 8))
        izq = tk.Frame(cab, bg=C["fondo"])
        izq.pack(side="left")
        self._lbl(izq, "🧠 NeuroAcceso", 18, negrita=True).pack(anchor="w")
        self._lbl(izq, "Control del PC y comunicación manos libres · Emotiv EPOC X",
                  10, C["tenue"]).pack(anchor="w")

        der = tk.Frame(cab, bg=C["fondo"])
        der.pack(side="right")
        if etiqueta_fuente:
            tk.Label(der, text=etiqueta_fuente, bg=C["amarillo"], fg="#000",
                     font=("Segoe UI", 9, "bold"), padx=8, pady=2).pack(side="left", padx=6)
        self.lbl_conexion = tk.Label(der, text="● Conectando…", bg=C["panel"], fg=C["alerta"],
                                     font=("Segoe UI", 10, "bold"), padx=10, pady=4)
        self.lbl_conexion.pack(side="left", padx=6)
        self.lbl_bateria = tk.Label(der, text="🔋 —", bg=C["panel"], fg=C["texto"],
                                    font=("Segoe UI", 10), padx=10, pady=4)
        self.lbl_bateria.pack(side="left", padx=6)
        self.lbl_senal = tk.Label(der, text="📶 Señal —", bg=C["panel"], fg=C["texto"],
                                  font=("Segoe UI", 10), padx=10, pady=4)
        self.lbl_senal.pack(side="left", padx=6)

    # ========================================================= pestaña estado
    def _tab_estado(self) -> None:
        tab = ttk.Frame(self.nb)
        self.nb.add(tab, text="  Estado del casco  ")
        tab.columnconfigure(0, weight=0)
        tab.columnconfigure(1, weight=1)
        tab.rowconfigure(0, weight=1)

        # --- mapa de contacto
        t_mapa = self._tarjeta(tab, "Calidad de contacto")
        t_mapa.grid(row=0, column=0, sticky="nsew", padx=(0, 10), pady=10)
        self.cv_mapa = tk.Canvas(t_mapa, width=330, height=320, bg=C["panel"],
                                 highlightthickness=0)
        self.cv_mapa.pack(padx=14)
        self._dibujar_cabeza()
        leyenda = tk.Frame(t_mapa, bg=C["panel"])
        leyenda.pack(padx=14, pady=(0, 12), anchor="w")
        for nivel in (4, 3, 2, 1, 0):
            color, txt = CALIDAD[nivel]
            tk.Label(leyenda, text="●", fg=color, bg=C["panel"],
                     font=("Segoe UI", 12)).pack(side="left")
            self._lbl(leyenda, txt + "  ", 9, C["tenue"]).pack(side="left")

        # --- columna derecha
        der = tk.Frame(tab, bg=C["fondo"])
        der.grid(row=0, column=1, sticky="nsew", pady=10)
        der.columnconfigure(0, weight=1)
        der.columnconfigure(1, weight=1)
        der.rowconfigure(1, weight=1)

        t_gesto = self._tarjeta(der, "Último gesto detectado")
        t_gesto.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        self.lbl_gesto = self._lbl(t_gesto, "—", 22, negrita=True)
        self.lbl_gesto.pack(anchor="w", padx=14)
        self.lbl_accion = self._lbl(t_gesto, "Esperando gestos…", 11, C["tenue"])
        self.lbl_accion.pack(anchor="w", padx=14, pady=(2, 14))

        t_cursor = self._tarjeta(der, "Cursor con la cabeza")
        t_cursor.grid(row=0, column=1, sticky="nsew")
        fila = tk.Frame(t_cursor, bg=C["panel"])
        fila.pack(fill="x", padx=14, pady=(0, 10))
        self.cv_orient = tk.Canvas(fila, width=110, height=110, bg="#101216",
                                   highlightthickness=0)
        self.cv_orient.pack(side="left")
        self.cv_orient.create_line(55, 0, 55, 110, fill=C["borde"])
        self.cv_orient.create_line(0, 55, 110, 55, fill=C["borde"])
        self.punto_orient = self.cv_orient.create_oval(49, 49, 61, 61, fill=C["acento"],
                                                       outline="")
        info = tk.Frame(fila, bg=C["panel"])
        info.pack(side="left", padx=12, fill="y")
        self.lbl_cursor = self._lbl(info, "Calibrando…", 15, C["alerta"], negrita=True)
        self.lbl_cursor.pack(anchor="w")
        self.lbl_orient = self._lbl(info, "yaw 0.0°  pitch 0.0°", 10, C["tenue"])
        self.lbl_orient.pack(anchor="w", pady=(2, 6))
        tk.Checkbutton(info, text="Mover el ratón real", variable=self.var_mover,
                       command=self._actualizar_mouse, bg=C["panel"], fg=C["texto"],
                       selectcolor=C["borde"], activebackground=C["panel"],
                       activeforeground=C["texto"], font=("Segoe UI", 10)).pack(anchor="w")
        tk.Button(info, text="Recalibrar centro", command=self._recalibrar,
                  bg=C["borde"], fg=C["texto"], relief="flat", padx=8,
                  activebackground=C["acento"]).pack(anchor="w", pady=(4, 0))

        t_log = self._tarjeta(der, "Registro de eventos")
        t_log.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=(10, 0))
        self.lst_log = tk.Listbox(t_log, height=6, bg="#101216", fg=C["texto"], font=("Consolas", 10),
                                  borderwidth=0, highlightthickness=0, activestyle="none",
                                  selectbackground=C["borde"])
        self.lst_log.pack(fill="both", expand=True, padx=14, pady=(0, 14))

        t_map = self._tarjeta(der, "Gestos configurados (modo cursor)")
        t_map.grid(row=2, column=0, columnspan=2, sticky="nsew", pady=(10, 0))
        txt = "    ".join(f"{NOMBRE_GESTO.get(g, g)} → {NOMBRE_ACCION.get(a, a)}"
                          for g, a in config.MAPEO_GESTOS_CURSOR.items())
        self._lbl(t_map, txt, 10).pack(anchor="w", padx=14, pady=(0, 12))

    def _dibujar_cabeza(self) -> None:
        cv, cx, cy, r = self.cv_mapa, 165, 168, 128
        cv.create_polygon(cx - 18, cy - r + 4, cx, cy - r - 22, cx + 18, cy - r + 4,
                          fill=C["panel"], outline=C["tenue"], width=2)  # nariz
        cv.create_oval(cx - r - 16, cy - 30, cx - r + 6, cy + 30, outline=C["tenue"], width=2)
        cv.create_oval(cx + r - 6, cy - 30, cx + r + 16, cy + 30, outline=C["tenue"], width=2)
        cv.create_oval(cx - r, cy - r, cx + r, cy + r, outline=C["tenue"], width=2,
                       fill=C["panel"])
        self.puntos_sensor: dict[str, int] = {}
        for nombre, (x, y) in {**SENSORES_POS, **REFERENCIAS}.items():
            px, py = cx + x * (r - 18), cy - y * (r - 18)
            es_ref = nombre in REFERENCIAS
            oval = cv.create_oval(px - 15, py - 15, px + 15, py + 15,
                                  fill=C["borde"] if es_ref else CALIDAD[0][0],
                                  outline="#000", width=1)
            cv.create_text(px, py, text=nombre, fill="#fff" if not es_ref else C["tenue"],
                           font=("Segoe UI", 7, "bold"))
            if not es_ref:
                self.puntos_sensor[nombre] = oval

    # ======================================================= pestaña práctica
    def _tab_practica(self) -> None:
        tab = ttk.Frame(self.nb)
        self.nb.add(tab, text="  Práctica de puntería  ")
        barra = tk.Frame(tab, bg=C["fondo"])
        barra.pack(fill="x", pady=(10, 6))
        self.btn_practica = tk.Button(barra, text="▶  Iniciar prueba (10 objetivos)",
                                      command=self._iniciar_practica, bg=C["acento"],
                                      fg="#fff", relief="flat", padx=16, pady=8,
                                      font=("Segoe UI", 12, "bold"))
        self.btn_practica.pack(side="left")
        self.lbl_practica = self._lbl(barra, "Mueve el cursor con la cabeza y haz clic "
                                      "apretando la mandíbula sobre cada círculo.", 11,
                                      C["tenue"])
        self.lbl_practica.pack(side="left", padx=14)
        self.cv_practica = tk.Canvas(tab, bg="#101216", highlightthickness=0, cursor="crosshair")
        self.cv_practica.pack(fill="both", expand=True)
        self.cv_practica.bind("<Button-1>", self._clic_practica)
        self._practica = None

    def _iniciar_practica(self) -> None:
        self._practica = {"n": 0, "total": 10, "aciertos": 0, "fallos": 0,
                          "tiempos": [], "inicio": time.monotonic(), "obj": None}
        self.btn_practica.config(text="↻  Reiniciar prueba")
        self._nuevo_objetivo()

    def _nuevo_objetivo(self) -> None:
        p = self._practica
        cv = self.cv_practica
        cv.delete("all")
        w, h = max(cv.winfo_width(), 400), max(cv.winfo_height(), 300)
        r = 38
        x, y = random.randint(r + 20, w - r - 20), random.randint(r + 20, h - r - 20)
        p["obj"] = (x, y, r)
        p["t0"] = time.monotonic()
        cv.create_oval(x - r, y - r, x + r, y + r, fill=C["acento"], outline="#fff", width=3)
        cv.create_oval(x - 6, y - 6, x + 6, y + 6, fill="#fff", outline="")
        cv.create_text(16, 16, anchor="nw", fill=C["tenue"], font=("Segoe UI", 11),
                       text=f"Objetivo {p['n'] + 1} de {p['total']}   ·   "
                            f"aciertos {p['aciertos']}   fallos {p['fallos']}")

    def _clic_practica(self, e) -> None:
        p = self._practica
        if not p or not p["obj"]:
            return
        x, y, r = p["obj"]
        if (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r:
            p["aciertos"] += 1
            p["tiempos"].append(time.monotonic() - p["t0"])
            p["n"] += 1
            self._log(f"🎯 Objetivo {p['n']} alcanzado en {p['tiempos'][-1]:.1f} s")
            if p["n"] >= p["total"]:
                self._fin_practica()
            else:
                self._nuevo_objetivo()
        else:
            p["fallos"] += 1
            self.cv_practica.create_oval(e.x - 4, e.y - 4, e.x + 4, e.y + 4, fill=C["error"],
                                         outline="")

    def _fin_practica(self) -> None:
        p = self._practica
        cv = self.cv_practica
        cv.delete("all")
        total = time.monotonic() - p["inicio"]
        medio = sum(p["tiempos"]) / len(p["tiempos"])
        precision = p["aciertos"] / (p["aciertos"] + p["fallos"]) * 100
        w, h = cv.winfo_width(), cv.winfo_height()
        cv.create_text(w / 2, h / 2 - 60, text="Prueba completada", fill=C["texto"],
                       font=("Segoe UI", 26, "bold"))
        cv.create_text(w / 2, h / 2 + 10, fill=C["tenue"], font=("Segoe UI", 15), justify="center",
                       text=f"Tiempo medio por objetivo: {medio:.1f} s\n"
                            f"Precisión de clic: {precision:.0f} %   ·   "
                            f"Objetivos por minuto: {p['total'] / total * 60:.1f}")
        self._log(f"📊 Práctica: {medio:.1f} s/objetivo, precisión {precision:.0f} %")
        p["obj"] = None

    # ===================================================== pestaña comunicador
    def _tab_comunicador(self) -> None:
        tab = ttk.Frame(self.nb)
        self.nb.add(tab, text="  Comunicador  ")
        self.comunicador = Comunicador(
            tab, self.eventos_com, al_salir=lambda: self.nb.select(TAB_ESTADO),
            al_hablar=lambda t: self._log(f"🔊 Habla: «{t}»"), tam_fuente=18,
        )
        self.comunicador.frame.pack(fill="both", expand=True)
        self.comunicador.activo = False

    # =================================================== pestaña configuración
    def _tab_config(self) -> None:
        tab = ttk.Frame(self.nb)
        self.nb.add(tab, text="  Configuración  ")
        t = self._tarjeta(tab, "Ajustes (se aplican al instante)")
        t.pack(fill="x", pady=10)

        def deslizador(texto, attr, desde, hasta, paso, al_cambiar=None):
            fila = tk.Frame(t, bg=C["panel"])
            fila.pack(fill="x", padx=14, pady=4)
            self._lbl(fila, texto, 11, width=38, anchor="w").pack(side="left")
            valor = self._lbl(fila, "", 11, C["acento"], negrita=True, width=8)
            var = tk.DoubleVar(value=getattr(config, attr))

            def cambio(*_):
                v = round(round(var.get() / paso) * paso, 3)
                setattr(config, attr, v)
                valor.config(text=str(v))
                if al_cambiar:
                    al_cambiar(v)

            ttk.Scale(fila, from_=desde, to=hasta, variable=var, command=cambio,
                      length=420).pack(side="left", padx=10)
            valor.pack(side="left")
            cambio()

        deslizador("Sensibilidad horizontal (px/grado)", "GANANCIA_X", 5, 60, 1)
        deslizador("Sensibilidad vertical (px/grado)", "GANANCIA_Y", 5, 60, 1)
        deslizador("Zona muerta (grados)", "ZONA_MUERTA", 0, 2, 0.05)
        deslizador("Suavizado del cursor", "SUAVIZADO", 0, 0.9, 0.05)
        deslizador("Umbral de intensidad de gestos", "UMBRAL_POTENCIA", 0.1, 0.9, 0.05,
                   lambda v: (setattr(self.det_cursor, "umbral", v),
                              setattr(self.det_com, "umbral", v)))
        deslizador("Anti-rebote entre acciones (s)", "COOLDOWN_S", 0.2, 3, 0.1,
                   lambda v: (setattr(self.det_cursor, "cooldown_s", v),
                              setattr(self.det_com, "cooldown_s", v)))
        deslizador("Velocidad de barrido del comunicador (s)", "TIEMPO_BARRIDO_S", 0.5, 3, 0.1)
        tk.Frame(t, bg=C["panel"], height=8).pack()

        t2 = self._tarjeta(tab, "Mapeo de gestos")
        t2.pack(fill="x", pady=10)
        for titulo, mapeo in (("Modo cursor", config.MAPEO_GESTOS_CURSOR),
                              ("Comunicador", config.MAPEO_GESTOS_COMUNICADOR)):
            fila = tk.Frame(t2, bg=C["panel"])
            fila.pack(fill="x", padx=14, pady=2)
            self._lbl(fila, titulo, 11, negrita=True, width=14, anchor="w").pack(side="left")
            self._lbl(fila, "     ·     ".join(
                f"{NOMBRE_GESTO.get(g, g)} → {NOMBRE_ACCION.get(a, a)}" for g, a in mapeo.items()
            ), 10, C["tenue"]).pack(side="left")
        self._lbl(t2, "Se cambia en src/neuroacceso/config.py", 9, C["tenue"]).pack(
            anchor="w", padx=14, pady=(6, 12))

    # ======================================================= lógica de control
    def _cambio_tab(self, _e=None) -> None:
        self.tab = self.nb.index(self.nb.select())
        en_com = self.tab == TAB_COMUNICADOR
        self.comunicador.activo = en_com
        if en_com:
            self.comunicador.reiniciar_barrido()
            self._log("⌨️ Comunicador activo: el cursor queda bloqueado")
        self._actualizar_mouse()

    def _actualizar_mouse(self) -> None:
        self.mouse.activo = (self.var_mover.get() and not self.pausado
                             and self.tab != TAB_COMUNICADOR)

    def _recalibrar(self) -> None:
        self.mouse._calib.clear()
        self.mouse._anterior = None
        self._ref_orient = None
        self._log("🎯 Recalibrando: mira al frente")

    # --- callbacks de Cortex (llegan en el hilo del WebSocket)
    def _on_mot(self, m: dict, t: float) -> None:
        self.mouse.procesar(m, t)
        if "Q0" in m:
            yaw, pitch = cuaternion_a_yaw_pitch(m["Q0"], m["Q1"], m["Q2"], m["Q3"])
            if self._ref_orient is None:
                self._ref_orient = (yaw, pitch)
            ahora = time.monotonic()
            if ahora - self._ult_orient > 0.08:
                self._ult_orient = ahora
                self.ui_q.put(("orient", _diferencia_angular(yaw, self._ref_orient[0]),
                               pitch - self._ref_orient[1], self.mouse.calibrado))

    def _on_fac(self, m: dict, t: float) -> None:
        crudo = None
        if m.get("eyeAct") not in (None, "neutral"):
            crudo = m["eyeAct"]
        elif m.get("lAct") not in (None, "neutral") and (m.get("lPow") or 0) > 0:
            crudo = m["lAct"]
        elif m.get("uAct") not in (None, "neutral") and (m.get("uPow") or 0) > 0:
            crudo = m["uAct"]
        if crudo != self._ult_gesto_crudo:
            self._ult_gesto_crudo = crudo
            if crudo:
                self.ui_q.put(("gesto", crudo))
        (self.det_com if self.tab == TAB_COMUNICADOR else self.det_cursor).procesar(m, t)

    def _on_dev(self, m: dict, t: float) -> None:
        self.ui_q.put(("dev", m))

    def _accion_cursor(self, accion: str, gesto: str) -> None:
        if accion == "pausar":
            self.pausado = not self.pausado
            self._actualizar_mouse()
            self.ui_q.put(("accion", gesto, "Cursor en pausa" if self.pausado else "Cursor reanudado"))
            return
        if self.pausado:
            self.ui_q.put(("accion", gesto, f"{NOMBRE_ACCION[accion]} ignorado (cursor en pausa)"))
            return
        if self.var_mover.get():
            {"clic": pyautogui.click, "clic_derecho": pyautogui.rightClick,
             "doble_clic": pyautogui.doubleClick}.get(accion, lambda: None)()
            self.ui_q.put(("accion", gesto, NOMBRE_ACCION[accion]))
        else:
            self.ui_q.put(("accion", gesto, f"{NOMBRE_ACCION[accion]} (ratón real desactivado)"))

    def _accion_com(self, accion: str, gesto: str) -> None:
        self.eventos_com.put(accion)
        self.ui_q.put(("accion", gesto, f"{NOMBRE_ACCION.get(accion, accion)} en el comunicador"))

    def _conectar(self) -> None:
        try:
            self.cortex.iniciar(["mot", "fac", "dev"])
            self.ui_q.put(("conexion", "ok", self.cortex.headset_id))
        except Exception as e:  # noqa: BLE001 — se muestra al usuario
            self.ui_q.put(("conexion", "error", str(e)))

    # ========================================================= actualizar UI
    def _procesar_ui(self) -> None:
        try:
            for _ in range(200):
                ev = self.ui_q.get_nowait()
                getattr(self, "_ui_" + ev[0])(*ev[1:])
        except queue.Empty:
            pass
        self.root.after(50, self._procesar_ui)

    def _ui_conexion(self, estado: str, detalle: str) -> None:
        self._estado_conexion(estado, detalle)

    def _estado_conexion(self, estado: str, detalle: str) -> None:
        if estado == "ok":
            self.lbl_conexion.config(text=f"● Conectado · {detalle}", fg=C["ok"])
            self._log(f"✅ Conectado a {detalle} vía {self.url}")
            self._log("🎯 Mira al frente ~2 s para calibrar el cursor")
        else:
            self.lbl_conexion.config(text="● Sin conexión", fg=C["error"])
            self._log(f"❌ {detalle}")

    def _ui_dev(self, m: dict) -> None:
        bat = m.get("BatteryPercent")
        if bat is not None:
            self.lbl_bateria.config(text=f"🔋 {bat}%",
                                    fg=C["texto"] if bat > 20 else C["error"])
        contacto = m.get("contacto") or {}
        overall = contacto.get("OVERALL")
        if overall is not None:
            color = C["ok"] if overall >= 80 else C["alerta"] if overall >= 50 else C["error"]
            self.lbl_senal.config(text=f"📶 Contacto {overall}%", fg=color)
        for s, oval in self.puntos_sensor.items():
            if s in contacto:
                self.cv_mapa.itemconfig(oval, fill=CALIDAD.get(int(contacto[s]), CALIDAD[0])[0])

    def _ui_orient(self, dyaw: float, dpitch: float, calibrado: bool) -> None:
        x = 55 - max(-50, min(50, dyaw * 2))
        y = 55 - max(-50, min(50, dpitch * 2))
        self.cv_orient.coords(self.punto_orient, x - 6, y - 6, x + 6, y + 6)
        self.lbl_orient.config(text=f"yaw {dyaw:+.1f}°  pitch {dpitch:+.1f}°")
        if not calibrado:
            self.lbl_cursor.config(text="Calibrando…", fg=C["alerta"])
        elif self.tab == TAB_COMUNICADOR:
            self.lbl_cursor.config(text="Bloqueado", fg=C["tenue"])
        elif self.pausado:
            self.lbl_cursor.config(text="En pausa", fg=C["alerta"])
        elif not self.var_mover.get():
            self.lbl_cursor.config(text="Solo visual", fg=C["tenue"])
        else:
            self.lbl_cursor.config(text="Activo", fg=C["ok"])

    def _ui_gesto(self, gesto: str) -> None:
        self.lbl_gesto.config(text=NOMBRE_GESTO.get(gesto, gesto))
        self.lbl_accion.config(text="(sin acción asignada)")

    def _ui_accion(self, gesto: str, texto: str) -> None:
        self.lbl_gesto.config(text=NOMBRE_GESTO.get(gesto, gesto))
        self.lbl_accion.config(text=f"→ {texto}", fg=C["amarillo"])
        self._log(f"{NOMBRE_GESTO.get(gesto, gesto)} → {texto}")

    def _log(self, texto: str) -> None:
        self.lst_log.insert(0, f"{time.strftime('%H:%M:%S')}  {texto}")
        if self.lst_log.size() > 300:
            self.lst_log.delete(300, "end")

    # ================================================================ ciclo
    def ejecutar(self) -> None:
        self.root.mainloop()

    def cerrar(self) -> None:
        if self.cortex:
            self.cortex.cerrar()
        self.root.destroy()
