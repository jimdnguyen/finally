$Container = docker ps -q -f name=finally-app 2>$null

if ($Container) {
    docker rm -f finally-app
    Write-Host "FinAlly stopped."
} else {
    Write-Host "FinAlly was not running."
}
