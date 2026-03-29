param(
  [Parameter(Mandatory = $true)]
  [string]$HandballSourceDatabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$TableTennisSourceDatabaseUrl
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-ComposeSh {
  param([Parameter(Mandatory = $true)][string]$Command)

  docker compose exec -T postgres sh -lc $Command
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose exec failed: $Command"
  }
}

function Invoke-DockerPgDump17 {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDatabaseUrl,
    [Parameter(Mandatory = $true)][string]$OutputFilePath
  )

  $escapedUrl = $SourceDatabaseUrl.Replace("'", "''")
  $dumpCmd = "pg_dump --no-owner --no-privileges '$escapedUrl'"

  $dumpText = docker run --rm postgres:17-alpine sh -lc $dumpCmd
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to dump source DB: $SourceDatabaseUrl"
  }

  [System.IO.File]::WriteAllText($OutputFilePath, $dumpText, [System.Text.UTF8Encoding]::new($false))
}

function Restore-SqlFileToLocalDb {
  param(
    [Parameter(Mandatory = $true)][string]$LocalDatabaseUrl,
    [Parameter(Mandatory = $true)][string]$SqlFilePath
  )

  Get-Content -Raw $SqlFilePath | docker compose exec -T postgres psql "$LocalDatabaseUrl" -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to restore SQL file: $SqlFilePath"
  }
}

function Invoke-StreamImportFromExternal {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDatabaseUrl,
    [Parameter(Mandatory = $true)][string]$LocalDatabaseUrl
  )

  $cmd = "set -e; pg_dump --no-owner --no-privileges '$SourceDatabaseUrl' | sed '/^SET transaction_timeout = 0;/d' | psql '$LocalDatabaseUrl' -v ON_ERROR_STOP=1"
  docker run --rm --network toyota_kosen_club_activities_default postgres:17-alpine sh -lc $cmd
  if ($LASTEXITCODE -ne 0) {
    throw "Failed stream import from: $SourceDatabaseUrl"
  }
}

$localHandballUrl = "postgresql://club:clubpass@localhost:5432/handball_notes"
$localTableTennisUrl = "postgresql://club:clubpass@localhost:5432/table_tennis_notes"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $repoRoot "backups\before-migration-$timestamp"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

Write-Host "[1/6] Starting local postgres container..."
docker compose up -d postgres | Out-Null

Write-Host "[2/6] Backing up current local handball DB..."
docker compose exec -T postgres sh -lc "pg_dump --clean --if-exists --no-owner --no-privileges '$localHandballUrl'" | Out-File -FilePath (Join-Path $backupDir "handball-local-before.sql") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "Failed to backup local handball DB" }

Write-Host "[3/6] Backing up current local table-tennis DB..."
docker compose exec -T postgres sh -lc "pg_dump --clean --if-exists --no-owner --no-privileges '$localTableTennisUrl'" | Out-File -FilePath (Join-Path $backupDir "table-tennis-local-before.sql") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "Failed to backup local table-tennis DB" }

Write-Host "[4/6] Importing external handball DB to local..."
Invoke-ComposeSh -Command "psql '$localHandballUrl' -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'"
Invoke-StreamImportFromExternal -SourceDatabaseUrl $HandballSourceDatabaseUrl -LocalDatabaseUrl $localHandballUrl

Write-Host "[5/6] Importing external table-tennis DB to local..."
Invoke-ComposeSh -Command "psql '$localTableTennisUrl' -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'"
Invoke-StreamImportFromExternal -SourceDatabaseUrl $TableTennisSourceDatabaseUrl -LocalDatabaseUrl $localTableTennisUrl

Write-Host "[6/6] Done. Local backups are stored in: $backupDir"
Write-Host "Next: docker compose up -d"
