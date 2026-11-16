# Prototipo (legacy)

Primera versión de NeuroAcceso en Python + tkinter, con demo sin casco. Se mantiene como **referencia** mientras el motor (`backend/`) y la interfaz (`frontend/`) la reemplazan.

```bash
cd legacy
python -m venv .venv && .venv\Scripts\activate
pip install -e ".[demo,dev]"
python -m neuroacceso --demo     # demo sin casco
python -m pytest -q              # pruebas
```

Detalles de la demo: [docs/demo.md](../docs/demo.md).
