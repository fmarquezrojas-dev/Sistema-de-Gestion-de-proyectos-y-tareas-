param([string]$ProjectName = 'synkro-clean-test')
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
$snapshot = Join-Path $env:TEMP ('SYNKRO revisión limpia '+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $snapshot | Out-Null
Push-Location $source
try {
  # Snapshot de archivos reales pendientes de commit, sin .env, caches ni dependencias.
  $files = @(git -c core.quotepath=false ls-files --cached --others --exclude-standard) | Sort-Object -Unique
  foreach ($file in $files) {
    $from = Join-Path $source $file
    if (Test-Path -LiteralPath $from -PathType Leaf) {
      $to = Join-Path $snapshot $file
      New-Item -ItemType Directory -Path (Split-Path -Parent $to) -Force | Out-Null
      Copy-Item -LiteralPath $from -Destination $to
    }
  }
  $sample = Join-Path $snapshot '.env.example'
  $text = (Get-Content -LiteralPath $sample -Raw).Replace('BACKEND_PORT=3000','BACKEND_PORT=53011').Replace('FRONTEND_PORT=5173','FRONTEND_PORT=55174').Replace('MAILPIT_PORT=8025','MAILPIT_PORT=58027')
  [IO.File]::WriteAllText($sample,$text,(New-Object Text.UTF8Encoding($false)))
  $launcher = Join-Path $snapshot 'scripts/synkro.ps1'
  function Run([string]$Action) {
    & powershell -NoProfile -ExecutionPolicy Bypass -File $launcher -Accion $Action -ProyectoNuevo $ProjectName -SinNavegador
    if ($LASTEXITCODE -ne 0) { throw "Falló $Action" }
  }
  Run 'Instalar'
  $config = Join-Path $snapshot '.env'
  $hash = (Get-FileHash -LiteralPath $config).Hash
  Run 'Demo'; Run 'Demo'
  Run 'Detener'; Run 'Iniciar'; Run 'Instalar'
  if ((Get-FileHash -LiteralPath $config).Hash -ne $hash) { throw 'Cambió la configuración al repetir' }
  Run 'Estado'
  Write-Host "PASS instalación limpia sin caches, ruta con espacios/Unicode, demo repetida, parada/reinicio y configuración conservada: $snapshot"
  # Se conservan snapshot y volumen de prueba para inspección. No se usa down -v.
  Run 'Detener'
} finally { Pop-Location }
