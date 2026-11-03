"""Teclado en pantalla con barrido + texto a voz.

Funciona con UNA sola señal: "seleccionar".
  1.er seleccionar → entra en la fila resaltada y empieza a barrer sus teclas.
  2.º seleccionar  → pulsa la tecla resaltada y vuelve al barrido de filas.
"""

from __future__ import annotations

import queue
import threading
import tkinter as tk

from . import config

try:
    import pyttsx3
except ImportError:  # el comunicador funciona sin voz si falta la librería
    pyttsx3 = None

COLOR_FONDO = "#1e1e1e"
COLOR_TECLA = "#3a3a3a"
COLOR_FILA = "#2f5d8a"
COLOR_TECLA_ACTIVA = "#f0a020"
COLOR_TEXTO = "#ffffff"


class Comunicador:
    def __init__(self, eventos: queue.Queue, simular: bool = False):
        self.eventos = eventos
        self.filas = [list(f) for f in config.FILAS_TECLADO] + [list(config.FRASES_RAPIDAS)]
        self.fila = 0
        self.tecla = 0
        self.en_fila = False
        self.texto = ""

        self.root = tk.Tk()
        self.root.title("NeuroAcceso — Comunicador")
        self.root.configure(bg=COLOR_FONDO)
        self.root.attributes("-topmost", True)

        self.lbl_texto = tk.Label(
            self.root, text="", font=("Segoe UI", 28), bg="#000", fg=COLOR_TEXTO,
            anchor="w", padx=12, height=2,
        )
        self.lbl_texto.pack(fill="x", padx=10, pady=10)

        self.botones: list[list[tk.Label]] = []
        for fila in self.filas:
            marco = tk.Frame(self.root, bg=COLOR_FONDO)
            marco.pack(fill="x", padx=10, pady=3)
            fila_btn = []
            for t in fila:
                b = tk.Label(
                    marco, text=t, font=("Segoe UI", 20, "bold"), bg=COLOR_TECLA,
                    fg=COLOR_TEXTO, padx=14, pady=10,
                )
                b.pack(side="left", padx=3, expand=True, fill="x")
                fila_btn.append(b)
            self.botones.append(fila_btn)

        self.lbl_estado = tk.Label(
            self.root, bg=COLOR_FONDO, fg="#aaa", font=("Segoe UI", 11),
            text="Simulación: pulsa ESPACIO para seleccionar" if simular
            else "Usa el gesto configurado para seleccionar",
        )
        self.lbl_estado.pack(pady=6)

        if simular:
            self.root.bind("<space>", lambda e: self.eventos.put("seleccionar"))

        self._pintar()
        self.root.after(int(config.TIEMPO_BARRIDO_S * 1000), self._avanzar)
        self.root.after(50, self._revisar_eventos)

    # ---------------------------------------------------------------- barrido
    def _avanzar(self) -> None:
        if self.en_fila:
            self.tecla += 1
            if self.tecla >= len(self.filas[self.fila]):  # fin de la fila: volver a filas
                self.en_fila = False
                self.tecla = 0
        else:
            self.fila = (self.fila + 1) % len(self.filas)
        self._pintar()
        self.root.after(int(config.TIEMPO_BARRIDO_S * 1000), self._avanzar)

    def _revisar_eventos(self) -> None:
        try:
            while True:
                if self.eventos.get_nowait() == "seleccionar":
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
                    b.config(bg=COLOR_TECLA_ACTIVA)
                elif i == self.fila:
                    b.config(bg=COLOR_FILA)
                else:
                    b.config(bg=COLOR_TECLA)

    # ------------------------------------------------------------------- voz
    @staticmethod
    def hablar(texto: str) -> None:
        if not texto.strip() or pyttsx3 is None:
            return

        def _hablar():
            motor = pyttsx3.init()
            motor.setProperty("rate", config.VELOCIDAD_VOZ)
            for voz in motor.getProperty("voices"):  # preferir una voz en español
                if "spanish" in voz.name.lower() or "es" in str(getattr(voz, "languages", "")).lower():
                    motor.setProperty("voice", voz.id)
                    break
            motor.say(texto)
            motor.runAndWait()

        threading.Thread(target=_hablar, daemon=True).start()

    def ejecutar(self) -> None:
        self.root.mainloop()
