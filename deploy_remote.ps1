# deploy_remote.ps1
# This script deploys the latest GitHub 'main' branch to the VPN server automatically.

$ServerIP = "88.210.12.157"
$SSHKey = "C:\Users\Tema\.ssh\vpn_server"

Write-Host "🚀 Starting Deployment to $ServerIP..." -ForegroundColor Cyan

# Define the remote command
$RemoteCommand = @"
cd ~/vpn_product && \
git fetch --all && \
git reset --hard origin/main && \
git pull origin main && \
PRIV=`$(grep REALITY_PRIVATE_KEY .env | cut -d '=' -f 2) && \
SHORT=`$(grep REALITY_SHORT_ID .env | cut -d '=' -f 2) && \
sed -i "s/SERVER_PRIVATE_KEY/`$PRIV/g" xray/config.json && \
sed -i "s/SERVER_SHORT_ID/`$SHORT/g" xray/config.json && \
docker-compose build backend frontend && \
docker-compose restart xray && \
docker-compose up -d
"@

Try {
    ssh -i "$SSHKey" -o StrictHostKeyChecking=no root@$ServerIP $RemoteCommand
    Write-Host "✅ Deployment Completed Successfully!" -ForegroundColor Green
} Catch {
    Write-Host "❌ Deployment Failed: $_" -ForegroundColor Red
}
