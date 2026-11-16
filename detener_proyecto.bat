@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\synkro.ps1" -Accion Detener %*
exit /b %ERRORLEVEL%
