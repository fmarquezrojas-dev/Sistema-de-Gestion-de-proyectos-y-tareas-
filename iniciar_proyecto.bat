@echo off
title Lanzador de Proyecto - Sistema Gestion
echo ==========================================
echo   INICIANDO CONTENEDORES CON DOCKER
echo ==========================================

:: 1. Levantar los servicios en segundo plano
echo [+] Construyendo y levantando servicios...
docker compose up -d --build

:: Esperar unos segundos para que la DB este lista
echo [+] Esperando 10 segundos a que la base de datos despierte...
timeout /t 10 /nobreak > nul

:: 2. Ejecutar migraciones de Prisma
echo [+] Sincronizando base de datos con Prisma...
docker compose exec backend npx prisma migrate dev --name init_usb

echo ==========================================
echo   PROYECTO LISTO Y CORRIENDO
echo ==========================================
echo [OK] Frontend: http://localhost:5173
echo [OK] Backend:  http://localhost:3000
echo ==========================================
pause