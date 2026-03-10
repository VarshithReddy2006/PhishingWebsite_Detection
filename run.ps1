Write-Host "---------------------------------------"
Write-Host " PhishGuard AI Runtime Script"
Write-Host "---------------------------------------"

$ErrorActionPreference = "Stop"

$rootDir = $PSScriptRoot
$venvPy  = Join-Path $rootDir ".venv\Scripts\python.exe"

function Invoke-SetupIfNeeded {
    if (!(Test-Path $venvPy)) {
        Write-Host "Virtual environment not found. Running setup.ps1..." -ForegroundColor Yellow
        powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "setup.ps1")
        return
    }

    # Fast dependency check (avoid re-installing every time).
    try {
        & $venvPy -c "import torch, transformers" | Out-Null
    } catch {
        Write-Host "Dependencies missing in .venv. Running setup.ps1..." -ForegroundColor Yellow
        powershell -ExecutionPolicy Bypass -File (Join-Path $rootDir "setup.ps1")
    }
}

# Check if virtual environment exists
if (!(Test-Path $venvPy)) {
    Invoke-SetupIfNeeded
}

Invoke-SetupIfNeeded

if (!(Test-Path $venvPy)) {
    Write-Host "Virtual environment still missing after setup. Aborting." -ForegroundColor Red
    exit 1
}

# Check if model exists; train if missing
$modelPath = Join-Path $rootDir "Backend\model_v1.pkl"

if (!(Test-Path $modelPath)) {
    Write-Host ""
    Write-Host "Model not found. Training model now..."
    Write-Host ""

    & $venvPy (Join-Path $rootDir "Backend\train.py")

    Write-Host ""
    Write-Host "Training completed."
}

# Start backend server
Write-Host ""
Write-Host "Starting PhishGuard backend server..."
Write-Host ""

& $venvPy (Join-Path $rootDir "Backend\app.py")
