@echo off
title Detener Proyecto - Sistema Gestion
echo ==========================================
echo   DETENIENDO CONTENEDORES...
echo ==========================================

:: Detiene los contenedores pero mantiene los datos de la DB
docker compose stop

echo ==========================================
echo   PROYECTO DETENIDO CORRECTAMENTE
echo ==========================================
pause