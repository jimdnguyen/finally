# scripts/stop_windows.ps1 — Stop and remove the running container
# Note: Volume persists (data is preserved)
# Usage: .\scripts\stop_windows.ps1

$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "finally-app"
$VolumeName = "finally-data"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if container exists
try {
    $AllContainers = docker ps -a --format "table {{.Names}}" 2>$null
    $ContainerExists = $AllContainers -match "^$ContainerName$"
}
catch {
    $ContainerExists = $false
}

if (!$ContainerExists) {
    Write-Warn "Container $ContainerName not found (already stopped?)"
    exit 0
}

# Stop the container
Write-Info "Stopping container $ContainerName..."
docker stop $ContainerName | Out-Null

# Remove the container
Write-Info "Removing container $ContainerName..."
docker rm $ContainerName | Out-Null

Write-Info "Container stopped and removed"
Write-Info "Volume $VolumeName persists (database preserved)"
Write-Host ""
Write-Host "To start again: .\scripts\start_windows.ps1"
Write-Host "To remove volume (delete database): docker volume rm $VolumeName"
