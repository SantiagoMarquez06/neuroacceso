# Genera la aplicación portable: backend\dist\NeuroAcceso\NeuroAcceso.exe
# Uso:  .\scripts\empaquetar.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

uv sync --group escritorio

$extra = @()
$interfaz = Resolve-Path "..\frontend\dist" -ErrorAction SilentlyContinue
if ($interfaz -and (Test-Path (Join-Path $interfaz "index.html"))) {
    $extra += @("--add-data", "$interfaz;frontend")
    Write-Host "Incluyendo la interfaz de $interfaz"
} else {
    Write-Host "Sin frontend\dist: el ejecutable mostrará la página del motor"
}

# --onedir (no --onefile): evita falsos positivos del antivirus y arranca más rápido.
uv run pyinstaller --noconfirm --clean --onedir --windowed --name NeuroAcceso `
    --collect-submodules neuroacceso_motor --collect-submodules uvicorn `
    --collect-submodules pyttsx3 --collect-submodules pynput `
    @extra scripts\lanzador.py

Copy-Item "..\.env.example" "dist\NeuroAcceso\.env.example" -Force
Write-Host "Listo: backend\dist\NeuroAcceso\NeuroAcceso.exe"
