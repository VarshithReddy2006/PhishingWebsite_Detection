Write-Host "---------------------------------------"
Write-Host " PhishGuard AI Setup Script"
Write-Host "---------------------------------------"

$ErrorActionPreference = "Stop"

# Check Python
Write-Host "Checking Python installation..."
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

if (-not $pythonCmd) {
    Write-Host "Python is not installed or not on PATH. Install Python 3.9+ and try again." -ForegroundColor Red
    exit 1
}

Write-Host "Python found: $($pythonCmd.Source)"

$venvDir = Join-Path $PSScriptRoot ".venv"
$venvPy  = Join-Path $venvDir "Scripts\python.exe"

# Create virtual environment if not exists
if (!(Test-Path $venvPy)) {
    Write-Host "Creating virtual environment at .venv ..."
    & python -m venv $venvDir
} else {
    Write-Host "Virtual environment already exists."
}

if (!(Test-Path $venvPy)) {
    Write-Host "Failed to create virtual environment. Check Python installation." -ForegroundColor Red
    exit 1
}

# Install dependencies (no activation required)
Write-Host "Upgrading pip..."
& $venvPy -m pip install --upgrade pip

Write-Host "Installing project dependencies..."
& $venvPy -m pip install -r (Join-Path $PSScriptRoot "requirements.txt")

# Verify torch + transformers installation
Write-Host "Checking PyTorch + Transformers installation..."
& $venvPy -c "import torch, transformers; print('PyTorch version:', torch.__version__); print('Transformers version:', transformers.__version__)"

Write-Host "---------------------------------------"
Write-Host " Setup Complete!"
Write-Host "---------------------------------------"
Write-Host "Next steps (no activation needed):"
Write-Host "1. Train the model:"
Write-Host "   .\.venv\Scripts\python.exe Backend\train.py"
Write-Host ""
Write-Host "2. Start the backend server:"
Write-Host "   .\.venv\Scripts\python.exe Backend\app.py"
Write-Host ""
Write-Host "3. Load Chrome extension from Extension/ folder"
Write-Host "---------------------------------------"
