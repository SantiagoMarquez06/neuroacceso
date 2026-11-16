"""Persistencia local en SQLite (stdlib).

shortcut: migraciones por PRAGMA user_version y JSON en columnas; si el modelo crece a más de
~10 tablas o hay varios clientes concurrentes, pasar a SQLAlchemy + Alembic.
"""

import json
import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .contrato import Ajustes, Intento, Metricas, Perfil, Sesion

MIGRACIONES = [
    """
    CREATE TABLE perfiles (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cortex_profile TEXT,
                           creado_en TEXT NOT NULL, ajustes TEXT NOT NULL);
    CREATE TABLE meta (clave TEXT PRIMARY KEY, valor TEXT);
    CREATE TABLE sesiones (id TEXT PRIMARY KEY,
                           perfil_id TEXT NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
                           tipo TEXT NOT NULL, inicio TEXT NOT NULL, fin TEXT, metricas TEXT);
    CREATE TABLE intentos (sesion_id TEXT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
                           datos TEXT NOT NULL);
    CREATE TABLE enunciados (sesion_id TEXT NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
                             datos TEXT NOT NULL);
    CREATE INDEX sesiones_perfil ON sesiones(perfil_id, inicio);
    """,
]


def ahora() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Datos:
    def __init__(self, ruta: str | Path):
        if str(ruta) != ":memory:":
            Path(ruta).parent.mkdir(parents=True, exist_ok=True)
        # Las llamadas llegan desde el bucle asyncio; el candado protege si alguna viene de un hilo.
        self.db = sqlite3.connect(str(ruta), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys = ON")
        self._candado = threading.Lock()
        self._migrar()

    def _migrar(self) -> None:
        version = self.db.execute("PRAGMA user_version").fetchone()[0]
        for i, sql in enumerate(MIGRACIONES[version:], start=version + 1):
            with self.db:
                self.db.executescript(sql)
                self.db.execute(f"PRAGMA user_version = {i}")

    def _q(self, sql: str, args: tuple[Any, ...] = ()) -> list[sqlite3.Row]:
        with self._candado, self.db:
            return self.db.execute(sql, args).fetchall()

    # ---------------------------------------------------------------- perfiles
    @staticmethod
    def _perfil(r: sqlite3.Row) -> Perfil:
        return Perfil(id=r["id"], nombre=r["nombre"], cortex_profile=r["cortex_profile"],
                      creado_en=r["creado_en"])

    def perfiles(self) -> list[Perfil]:
        return [self._perfil(r) for r in self._q("SELECT * FROM perfiles ORDER BY creado_en")]

    def perfil(self, pid: str) -> Perfil | None:
        filas = self._q("SELECT * FROM perfiles WHERE id = ?", (pid,))
        return self._perfil(filas[0]) if filas else None

    def crear_perfil(self, nombre: str, cortex_profile: str | None) -> Perfil:
        pid = uuid.uuid4().hex[:12]
        self._q("INSERT INTO perfiles VALUES (?, ?, ?, ?, ?)",
                (pid, nombre, cortex_profile, ahora(), Ajustes().model_dump_json()))
        return self.perfil(pid)  # type: ignore[return-value]

    def editar_perfil(self, pid: str, cambios: dict[str, Any]) -> Perfil | None:
        for campo in ("nombre", "cortex_profile"):  # columnas fijas: nunca nombres del cliente
            if campo in cambios:
                self._q(f"UPDATE perfiles SET {campo} = ? WHERE id = ?", (cambios[campo], pid))
        return self.perfil(pid)

    def borrar_perfil(self, pid: str) -> bool:
        if self.perfil_activo() == pid:
            self._q("DELETE FROM meta WHERE clave = 'perfil_activo'")
        return bool(self._q("DELETE FROM perfiles WHERE id = ? RETURNING id", (pid,)))

    def ajustes(self, pid: str) -> Ajustes | None:
        filas = self._q("SELECT ajustes FROM perfiles WHERE id = ?", (pid,))
        return Ajustes.model_validate_json(filas[0]["ajustes"]) if filas else None

    def guardar_ajustes(self, pid: str, ajustes: Ajustes) -> None:
        self._q("UPDATE perfiles SET ajustes = ? WHERE id = ?", (ajustes.model_dump_json(), pid))

    def perfil_activo(self) -> str | None:
        filas = self._q("SELECT valor FROM meta WHERE clave = 'perfil_activo'")
        return filas[0]["valor"] if filas else None

    def activar(self, pid: str) -> None:
        self._q("INSERT OR REPLACE INTO meta VALUES ('perfil_activo', ?)", (pid,))

    # ---------------------------------------------------------------- sesiones
    @staticmethod
    def _sesion(r: sqlite3.Row) -> Sesion:
        m = Metricas.model_validate_json(r["metricas"]) if r["metricas"] else None
        return Sesion(id=r["id"], perfil_id=r["perfil_id"], tipo=r["tipo"], inicio=r["inicio"],
                      fin=r["fin"], metricas=m)

    def crear_sesion(self, perfil_id: str, tipo: str) -> Sesion:
        sid = uuid.uuid4().hex[:12]
        self._q("INSERT INTO sesiones (id, perfil_id, tipo, inicio) VALUES (?, ?, ?, ?)",
                (sid, perfil_id, tipo, ahora()))
        return self.sesion(sid)  # type: ignore[return-value]

    def sesion(self, sid: str) -> Sesion | None:
        filas = self._q("SELECT * FROM sesiones WHERE id = ?", (sid,))
        return self._sesion(filas[0]) if filas else None

    def sesiones(self, perfil_id: str | None = None, desde: str | None = None,
                 hasta: str | None = None) -> list[Sesion]:
        sql, args = "SELECT * FROM sesiones WHERE 1 = 1", list[str]()
        if perfil_id:
            sql, args = sql + " AND perfil_id = ?", [*args, perfil_id]
        if desde:
            sql, args = sql + " AND inicio >= ?", [*args, desde]
        if hasta:
            sql, args = sql + " AND inicio <= ?", [*args, hasta]
        return [self._sesion(r) for r in self._q(sql + " ORDER BY inicio DESC", tuple(args))]

    def finalizar(self, sid: str, metricas: Metricas) -> Sesion | None:
        self._q("UPDATE sesiones SET fin = COALESCE(fin, ?), metricas = ? WHERE id = ?",
                (ahora(), metricas.model_dump_json(), sid))
        return self.sesion(sid)

    def agregar_intentos(self, sid: str, intentos: list[Intento]) -> None:
        with self._candado, self.db:
            self.db.executemany("INSERT INTO intentos VALUES (?, ?)",
                                [(sid, i.model_dump_json()) for i in intentos])

    def intentos(self, sid: str) -> list[Intento]:
        return [Intento.model_validate_json(r["datos"])
                for r in self._q("SELECT datos FROM intentos WHERE sesion_id = ?", (sid,))]

    def agregar_enunciado(self, sid: str, datos: dict[str, Any]) -> None:
        self._q("INSERT INTO enunciados VALUES (?, ?)", (sid, json.dumps(datos)))

    def enunciados(self, sid: str) -> list[dict[str, Any]]:
        return [json.loads(r["datos"])
                for r in self._q("SELECT datos FROM enunciados WHERE sesion_id = ?", (sid,))]
