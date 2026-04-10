# scripts/start_windows.ps1 — Idempotent Docker start wrapper for Windows
# Usage: .\scripts\start_windows.ps1 [-Build]

param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"

# Configuration
$ImageName = "finally"
$ContainerName = "finally-app"
$Port = 8000
$VolumeName = "finally-data"
$EnvFile = ".env"

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

# Step 1: Check if .env exists
if (!(Test-Path $EnvFile)) {
    Write-Error "$EnvFile not found"
    Write-Host ""
    Write-Host "Please create $EnvFile from .env.example:"
    Write-Host "  copy .env.example .env"
    Write-Host "  # Edit .env and add your OPENROUTER_API_KEY"
    exit 1
}

Write-Info "Found $EnvFile"

# Step 2: Check if container is already running
try {
    $RunningContainers = docker ps --format "table {{.Names}}" 2>$null
    if ($RunningContainers -match "^$ContainerName$") {
        Write-Warn "Container $ContainerName already running"
        Write-Info "Access at http://localhost:$Port"
        Write-Info "View logs: docker logs -f $ContainerName"
        exit 0
    }
}
catch {
    # Docker not running or not installed; proceed
}

# Step 3: Check if stopped container exists; remove it
try {
    $AllContainers = docker ps -a --format "table {{.Names}}" 2>$null
    if ($AllContainers -match "^$ContainerName$") {
        Write-Warn "Removing stopped container $ContainerName..."
        docker rm $ContainerName | Out-Null
    }
}
catch {
    # Container doesn't exist; proceed
}

# Step 4: Create volume if it doesn't exist
try {
    docker volume inspect $VolumeName > $null 2>&1
    Write-Info "Using existing Docker volume $VolumeName"
}
catch {
    Write-Info "Creating Docker volume $VolumeName..."
    docker volume create $VolumeName | Out-Null
}

# Step 5: Build image (unless --no-build and image exists)
$ImageExists = $false
try {
    docker image inspect $ImageName > $null 2>&1
    $ImageExists = $true
}
catch {
    $ImageExists = $false
}

if ($Build -or !$ImageExists) {
    Write-Info "Building Docker image $ImageName..."
    docker build -t $ImageName . | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed"
        exit 1
    }
}
else {
    Write-Info "Using existing Docker image $ImageName"
}

# Step 6: Run container
Write-Info "Starting container $ContainerName..."
docker run `
    --name $ContainerName `
    -p "${Port}:8000" `
    -v "${VolumeName}:/app/db" `
    --env-file $EnvFile `
    -d `
    $ImageName

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start container"
    exit 1
}

# Step 7: Wait for container to be healthy
Write-Info "Waiting for app to be ready (up to 30 seconds)..."
$Healthy = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $Response = docker exec $ContainerName curl -f http://localhost:8000/api/health 2>$null
        if ($Response) {
            Write-Info "App is healthy!"
            $Healthy = $true
            break
        }
    }
    catch {
        # Health check failed; retry
    }

    Write-Host "." -NoNewline
    Start-Sleep -Seconds 1
}

if (!$Healthy) {
    Write-Error "App failed to become healthy within 30 seconds"
    Write-Info "Check logs: docker logs $ContainerName"
    exit 1
}

# Step 8: Print access instructions
Write-Host ""
Write-Info "Container started successfully!"
Write-Host ""
Write-Host "Access the app at: http://localhost:$Port"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs:    docker logs -f $ContainerName"
Write-Host "  Stop:         .\scripts\stop_windows.ps1"
Write-Host "  Rebuild:      .\scripts\start_windows.ps1 -Build"
Write-Host ""
