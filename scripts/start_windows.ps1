param(
    [switch]$Build = $false
)

$CONTAINER_NAME = "finally-app"
$IMAGE_NAME = "finally-app"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

# Check for --build flag or if image doesn't exist
docker image inspect $IMAGE_NAME *>$null
$ImageExists = $LASTEXITCODE -eq 0
if ($Build -or -not $ImageExists) {
    Write-Host "Building FinAlly..."
    docker build -t $IMAGE_NAME $ProjectRoot
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker build failed"
        exit 1
    }
}

# Stop existing container if running
docker rm -f $CONTAINER_NAME 2>$null

# Run container
docker run -d `
    --name $CONTAINER_NAME `
    -p 8000:8000 `
    -v finally-data:/app/db `
    --env-file "$ProjectRoot\.env" `
    $IMAGE_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "FinAlly is running at http://localhost:8000"

    # Open browser (Windows)
    Start-Sleep -Seconds 2
    Start-Process http://localhost:8000
} else {
    Write-Host "Failed to start FinAlly"
    exit 1
}
