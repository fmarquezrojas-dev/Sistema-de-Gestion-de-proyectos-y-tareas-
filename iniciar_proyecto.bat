@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\synkro.ps1" %*
exit /b %ERRORLEVEL%
