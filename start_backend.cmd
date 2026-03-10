@echo off
setlocal
cd /d "%~dp0"

REM One-command backend runner (no PowerShell activation required).
REM Auto-creates .venv / installs deps if missing, trains if model missing, then starts Flask.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"

endlocal
