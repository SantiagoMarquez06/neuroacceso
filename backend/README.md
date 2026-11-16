# Motor de NeuroAcceso (backend)

Servicio local en Python que se conecta al **Emotiv EPOC X** (vía EMOTIV Launcher / Cortex), procesa en tiempo real el movimiento de la cabeza, las expresiones faciales y los comandos mentales, controla el ratón del sistema operativo y ofrece la **API v1** que usa la interfaz.

- Arquitectura: [../docs/arquitectura-sistema.md](../docs/arquitectura-sistema.md)
- Contrato con la interfaz: [../contrato/](../contrato/)
- Prueba con el casco real: [../docs/integracion.md](../docs/integracion.md)

## Requisitos
- Windows 10/11, Python 3.12 y [uv](https://docs.astral.sh/uv/)
- Para el casco real: EMOTIV Launcher y un `.env` en la raíz del repo con `EMOTIV_CLIENT_ID` y `EMOTIV_CLIENT_SECRET` (ver `.env.example`)

## Uso
```bash
cd backend
uv sync

uv run python -m neuroacceso_motor --demo        # casco simulado (sin hardware)
uv run python -m neuroacceso_motor               # casco real
uv run python -m neuroacceso_motor --grabar ../backend/grabaciones/sesion.jsonl   # grabar
uv run python -m neuroacceso_motor --replay grabaciones/sesion.jsonl              # reproducir
uv run python -m neuroacceso_motor --demo --dev  # para desarrollar la interfaz con Vite (5173)

# Ver los eventos en consola (el token lo imprime el motor al arrancar)
uv run python scripts/cliente_ws.py TOKEN --sin-orientacion
```

| Opción | Efecto |
|---|---|
| `--demo` | Casco simulado; habilita `/api/v1/dev/simular/*` |
| `--replay ARCHIVO` / `--grabar ARCHIVO` | Reproducir / grabar sesiones en JSONL |
| `--escritorio` | Abre la ventana de la aplicación y la barra flotante (requiere `uv sync --group escritorio`) |
| `--dev` | Permite el origen de Vite y la documentación en `/docs` |
| `--sin-raton` | No mueve el ratón real (útil al desarrollar) |
| `--sin-atajos` | Sin atajos de emergencia |
| `--datos RUTA` | Base de datos (por defecto `%LOCALAPPDATA%\NeuroAcceso\neuroacceso.db`) |
| `--puerto N` | Puerto local (por defecto 8765) |

**Atajos de emergencia** (para el acompañante): `Ctrl+Alt+P` pausa/reanuda el cursor · `Ctrl+Alt+C` recalibra.

## Pruebas y calidad
```bash
uv run pytest -q          # unitarias, fuentes (con Cortex falso), motor, API, métricas, latencia
uv run ruff check
uv run mypy src
uv run python -m neuroacceso_motor.exportar_contrato   # regenerar contrato/ tras cambiar contrato.py
```

## Ejecutable
```powershell
uv sync --group escritorio
.\scripts\empaquetar.ps1      # genera dist\NeuroAcceso\NeuroAcceso.exe (carpeta portable)
```
