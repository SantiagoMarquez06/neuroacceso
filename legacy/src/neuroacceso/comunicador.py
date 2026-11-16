"""Teclado en pantalla con barrido + texto a voz.

Funciona con UNA sola señal: "seleccionar".
  1.er seleccionar → entra en la fila resaltada y empieza a barrer sus teclas.
  2.º seleccionar  → pulsa la tecla resaltada y vuelve al barrido de filas.

Se puede usar como ventana propia (Comunicador(None, …)) o dentro de otra
interfaz pasando un Frame como `master`.
"""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from typing import Callable

from . import config

try:
    import pyttsx3
except ImportError:  # el comunicador funciona sin voz si falta la librería
    pyttsx3 = None

COLOR_FONDO = "#14161a"
COLOR_TECLA = "#2a2e36"
COLOR_FILA = "#2f5d8a"
COLOR_TECLA_ACTIVA = "#f0a020"
COLOR_TEXTO = "#e8eaed"
TECLA_SALIR = "◀ SALIR"


class Comunicador:
    def __init__(
        self,
        master: tk.Misc | None,
        eventos: queue.Queue,
        simular: bool = False,
        al_salir: Callable[[], None] | None = None,
        al_hablar: Callable[[str], None] | None = None,
        tam_fuente: int = 20,
    ):
        self.eventos = eventos
        self.al_salir = al_salir
        self.al_hablar = al_hablar
        self.activo = True  # si es False, el barrido se detiene (p. ej. pestaña oculta)

        controles = list(config.FILAS_TECLADO[-1]) if config.FILAS_TECLADO else []
        filas = [list(f) for f in config.FILAS_TECLADO[:-1]]
        if al_salir:
            controles = controles + [TECLA_SALIR]
        self.filas = filas + [controles, list(config.FRASES_RAPIDAS)]
        self.fila = 0
        self.tecla = 0
        self.en_fila = False
        self.texto = ""

        if master is None:
            self.root = tk.Tk()
            self.root.title("NeuroAcceso — Comunicador")
            self.root.attributes("-topmost", True)
            self.frame = tk.Frame(self.root, bg=COLOR_FONDO)
            self.frame.pack(fill="both", expand=True)
        else:
            self.root = master.winfo_toplevel()
            self.frame = tk.Frame(master, bg=COLOR_FONDO)
        self.frame.configure(bg=COLOR_FONDO)

        self.lbl_texto = tk.Label(
            self.frame, text="", font=("Segoe UI", tam_fuente + 6), bg="#000", fg=COLOR_TEXTO,
            anchor="w", padx=12, height=2,
        )
        self.lbl_texto.pack(fill="x", padx=10, pady=10)

        self.botones: list[list[tk.Label]] = []
        for i, fila in enumerate(self.filas):
            marco = tk.Frame(self.frame, bg=COLOR_FONDO)
            marco.pack(fill="x", padx=10, pady=3)
            fila_btn = []
            es_frases = i == len(self.filas) - 1
            for t in fila:
                b = tk.Label(
                    marco, text=t, bg=COLOR_TECLA, fg=COLOR_TEXTO, padx=10, pady=8,
                    font=("Segoe UI", tam_fuente - 6 if es_frases else tam_fuente, "bold"),
                )
                b.pack(side="left", padx=3, expand=True, fill="x")
                fila_btn.append(b)
            self.botones.append(fila_btn)

        self.lbl_estado = tk.Label(
            self.frame, bg=COLOR_FONDO, fg="#9aa0a6", font=("Segoe UI", 10),
            text="Simulación: pulsa ESPACIO para seleccionar" if simular
            else "Selecciona con el gesto configurado (por defecto: apretar la mandíbula)",
        )
        self.lbl_estado.pack(pady=6)

        if simular:
            self.root.bind("<space>", lambda e: self.eventos.put("seleccionar"))

        self._pintar()
        self.root.after(int(config.TIEMPO_BARRIDO_S * 1000), self._avanzar)
        self.root.after(50, self._revisar_eventos)

    def reiniciar_barrido(self) -> None:
        self.fila = 0
        self.tecla = 0
        self.en_fila = False
        self._pintar()

    # ---------------------------------------------------------------- barrido
    def _avanzar(self) -> None:
        if self.activo:
            if self.en_fila:
                self.tecla += 1
                if self.tecla >= len(self.filas[self.fila]):  # fin de fila: volver a filas
                    self.en_fila = False
                    self.tecla = 0
            else:
                self.fila = (self.fila + 1) % len(self.filas)
            self._pintar()
        self.root.after(int(config.TIEMPO_BARRIDO_S * 1000), self._avanzar)

    def _revisar_eventos(self) -> None:
        try:
            while True:
                if self.eventos.get_nowait() == "seleccionar" and self.activo:
                    self._seleccionar()
        except queue.Empty:
            pass
        self.root.after(50, self._revisar_eventos)

    def _seleccionar(self) -> None:
        if not self.en_fila:
            self.en_fila = True
            self.tecla = 0
        else:
            self._pulsar(self.filas[self.fila][self.tecla])
            self.en_fila = False
            self.tecla = 0
        self._pintar()

    def _pulsar(self, t: str) -> None:
        if t == "ESPACIO":
            self.texto += " "
        elif t == "BORRAR":
            self.texto = self.texto[:-1]
        elif t == "LIMPIAR":
            self.texto = ""
        elif t == "HABLAR":
            self.hablar(self.texto)
        elif t == TECLA_SALIR:
            if self.al_salir:
                self.al_salir()
        elif t in config.FRASES_RAPIDAS:
            self.hablar(t)
        else:
            self.texto += t

    # ------------------------------------------------------------------ vista
    def _pintar(self) -> None:
        self.lbl_texto.config(text=self.texto + "▌")
        for i, fila in enumerate(self.botones):
            for j, b in enumerate(fila):
                if i == self.fila and self.en_fila and j == self.tecla:
                    b.config(bg=COLOR_TECLA_ACTIVA, fg="#000")
                elif i == self.fila:
                    b.config(bg=COLOR_FILA, fg=COLOR_TEXTO)
                else:
                    b.config(bg=COLOR_TECLA, fg=COLOR_TEXTO)

    # ------------------------------------------------------------------- voz
    def hablar(self, texto: str) -> None:
        if not texto.strip():
            return
        if self.al_hablar:
            self.al_hablar(texto)
        if pyttsx3 is None:
            return

        def _hablar():
            try:
                motor = pyttsx3.init()
                motor.setProperty("rate", config.VELOCIDAD_VOZ)
                for voz in motor.getProperty("voices"):  # preferir una voz en español
                    if "spanish" in voz.name.lower() or "español" in voz.name.lower():
                        motor.setProperty("voice", voz.id)
                        break
                motor.say(texto)
                motor.runAndWait()
            except Exception:
                pass  # sin voz disponible: el texto sigue en pantalla

        threading.Thread(target=_hablar, daemon=True).start()

    def ejecutar(self) -> None:
        self.root.mainloop()
