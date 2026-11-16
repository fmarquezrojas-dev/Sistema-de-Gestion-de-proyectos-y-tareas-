param(
  [ValidateSet('Instalar','Iniciar','Detener','Estado','Actualizar','Demo')][string]$Accion = 'Iniciar',
  [string]$Config = '.env',
  [string]$ProyectoNuevo = 'sistema_gestion_proyectos_tareas',
  [switch]$SinNavegador
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$phase = 'precomprobaciones'
function Invoke-Docker([string[]]$DockerArgs, [int]$TimeoutSeconds = 600, [switch]$Quiet) {
  # Argumentos estructurados; nunca ejecutar Compose config expandido ni mostrar secretos.
  $out = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString()+'.out')
  $err = $out+'.err'
  try {
    $quoted = ($DockerArgs | ForEach-Object { '"'+($_ -replace '"','\"')+'"' }) -join ' '
    $process = Start-Process -FilePath $script:docker -ArgumentList $quoted -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
    $handle = $process.Handle
    if (!$process.WaitForExit($TimeoutSeconds * 1000)) { $process.Kill(); throw 'Docker excedió el tiempo máximo; no se eliminaron datos.' }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw 'Docker devolvió error. Comprueba motor, credenciales, puertos y logs del servicio; no se imprimió configuración sensible.' }
    $result = Get-Content -LiteralPath $out -Raw
    if (!$Quiet) { return $result }
  } finally {
    # Archivos individuales temporales creados por esta invocación, nunca directorios.
    Remove-Item -LiteralPath $out,$err -Force -ErrorAction SilentlyContinue
  }
}
function Compose([string[]]$Arguments, [int]$Timeout = 600, [switch]$Quiet) {
  Invoke-Docker -DockerArgs (@('compose','--project-directory',$root,'--env-file',$script:configPath,'-f',(Join-Path $root 'docker-compose.yml')) + $Arguments) -TimeoutSeconds $Timeout -Quiet:$Quiet
}
function New-Secret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
Push-Location $root
try {
  if ($PSVersionTable.PSVersion -lt [version]'5.1') { throw 'Se requiere Windows PowerShell 5.1 o PowerShell 7.' }
  $script:docker = (Get-Command docker -ErrorAction Stop).Source
  Invoke-Docker -DockerArgs @('compose','version','--short') -TimeoutSeconds 20 -Quiet
  if ((Invoke-Docker -DockerArgs @('info','--format','{{.OSType}}') -TimeoutSeconds 20).Trim() -ne 'linux') { throw 'Activa contenedores Linux en Docker Desktop.' }
  foreach ($file in @('docker-compose.yml','.env.example','backend/Dockerfile','frontend/Dockerfile','notification-service/Dockerfile')) {
    if (!(Test-Path -LiteralPath (Join-Path $root $file))) { throw "Falta archivo requerido: $file" }
  }
  $script:configPath = if ([IO.Path]::IsPathRooted($Config)) { $Config } else { Join-Path $root $Config }
  if (!(Test-Path -LiteralPath $script:configPath)) {
    if ($Accion -ne 'Instalar') { throw 'Falta configuración. Ejecuta -Accion Instalar o indica -Config.' }
    $volumes = Invoke-Docker -DockerArgs @('volume','ls','--format','{{.Name}}') -TimeoutSeconds 20
    if ($ProyectoNuevo -notmatch '^[a-z0-9][a-z0-9_-]+$') { throw 'Nombre de proyecto inválido.' }
    if (($volumes -split '\r?\n') -contains ($ProyectoNuevo + '_postgres_data')) {
      throw 'Existe el volumen habitual sin configuración raíz. Copia .env.example, conserva su usuario/base/contraseña existentes y completa secretos. No se generaron credenciales nuevas sobre esa base.'
    }
    $text = (Get-Content -LiteralPath (Join-Path $root '.env.example') -Raw).Replace('COMPOSE_PROJECT_NAME=sistema_gestion_proyectos_tareas', "COMPOSE_PROJECT_NAME=$ProyectoNuevo")
    foreach ($key in @('POSTGRES_PASSWORD','JWT_SECRET','NOTIFICATION_INTERNAL_SECRET')) { $text = $text -replace "(?m)^$key=\r?$", "$key=$(New-Secret)" }
    [IO.File]::WriteAllText($script:configPath, $text, (New-Object Text.UTF8Encoding($false)))
    Write-Host 'Configuración nueva creada sin mostrar secretos.'
  }
  $settings = @{}
  foreach ($line in Get-Content -LiteralPath $script:configPath) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$matches[1]] = $matches[2].Trim() }
  }
  foreach ($key in @('COMPOSE_PROJECT_NAME','POSTGRES_USER','POSTGRES_DB','POSTGRES_PASSWORD','JWT_SECRET','NOTIFICATION_INTERNAL_SECRET','BACKEND_PORT','FRONTEND_PORT','MAILPIT_PORT')) {
    if (!$settings[$key]) { throw "Configuración incompleta: $key. Archivo conservado." }
  }
  foreach ($key in @('JWT_SECRET','NOTIFICATION_INTERNAL_SECRET')) { if ($settings[$key].Length -lt 32) { throw "$key debe tener al menos 32 caracteres. Archivo conservado." } }
  foreach ($key in @('POSTGRES_USER','POSTGRES_DB','POSTGRES_PASSWORD')) { if ($settings[$key] -notmatch '^[a-zA-Z0-9_-]+$') { throw "$key debe usar caracteres URI seguros para esta configuración local." } }
  if ($settings.COMPOSE_PROJECT_NAME -notmatch '^[a-z0-9][a-z0-9_-]+$') { throw 'Nombre de proyecto Compose inválido.' }
  Compose -Arguments @('config','--quiet') -Quiet
  if ($Accion -eq 'Estado') { Compose -Arguments @('ps'); Write-Host 'Configuración válida. /health/ready verifica DB; salud Python no certifica SMTP.'; exit 0 }
  if ($Accion -eq 'Detener') { Compose -Arguments @('stop') -Quiet; Write-Host 'Servicios detenidos; datos y volúmenes conservados.'; exit 0 }
  if ($Accion -eq 'Demo') { Compose -Arguments @('exec','-T','backend','node','scripts/demo.mjs'); exit 0 }
  foreach ($pair in @(@('BACKEND_PORT','backend'),@('FRONTEND_PORT','frontend'),@('MAILPIT_PORT','mailpit'))) {
    $port = 0
    if (![int]::TryParse($settings[$pair[0]], [ref]$port) -or $port -lt 1024 -or $port -gt 65535) { throw "Puerto inválido: $($pair[0])" }
    $own = Compose -Arguments @('ps','-q',$pair[1])
    $occupied = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    $ownedPort = $false
    if ($own) {
      $details = (Invoke-Docker -DockerArgs @('inspect', $own.Trim(), '--format', '{{json .NetworkSettings.Ports}}') -TimeoutSeconds 20) | ConvertFrom-Json
      foreach ($property in $details.PSObject.Properties) { foreach ($binding in $property.Value) { if ($binding.HostPort -eq "$port") { $ownedPort = $true } } }
    }
    if ($occupied -and !$ownedPort) { throw "Puerto $port ocupado por otro proceso. Cambia configuración; no se detuvo ningún proceso." }
  }
  if ($Accion -in @('Instalar','Actualizar')) {
    if ($Accion -eq 'Actualizar') { Write-Host 'Actualiza desde código ya descargado. Respaldo previo: docs/operations.md. No se ejecutará git pull.' }
    $phase = 'construcción'; Write-Host "Fase: $phase (puede tardar varios minutos)"
    Compose -Arguments @('build','--pull') -Timeout 1200 -Quiet
  }
  $phase = 'PostgreSQL'; Write-Host "Fase: $phase"
  Compose -Arguments @('up','-d','--wait','--wait-timeout','90','db') -Timeout 120 -Quiet
  $phase = 'migraciones'; Write-Host "Fase: $phase"
  Compose -Arguments @('run','--rm','--no-deps','backend','npx','prisma','migrate','deploy') -Timeout 120 -Quiet
  $phase = 'servicios y salud'; Write-Host "Fase: $phase"
  Compose -Arguments @('up','-d','--wait','--wait-timeout','120') -Timeout 180 -Quiet
  $web = "http://localhost:$($settings.FRONTEND_PORT)"
  $response = Invoke-WebRequest -Uri $web -UseBasicParsing -TimeoutSec 10
  if ($response.StatusCode -ne 200) { throw 'La interfaz aún no está disponible.' }
  Write-Host "SYNKRO: $web | API: http://localhost:$($settings.BACKEND_PORT) | Mailpit: http://localhost:$($settings.MAILPIT_PORT)"
  if (!$SinNavegador) { Start-Process $web }
} catch {
  Write-Host "ERROR en fase '$phase': $($_.Exception.Message)" -ForegroundColor Red
  exit 1
} finally { Pop-Location }
