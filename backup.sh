#!/bin/bash
# VPN Service Backup Script
# Runs daily via crontab to archive DB, configs, and source code

BACKUP_DIR="$HOME/vpn_product/backups"
PROJECT_DIR="$HOME/vpn_product"
DATE=$(date +%Y-%m-%d_%H-%M)

mkdir -p "$BACKUP_DIR"

# Create backup archive
tar -czf "$BACKUP_DIR/vpn-backup-$DATE.tar.gz" \
    -C "$PROJECT_DIR" \
    data/ xray/ .env docker-compose.yml \
    backend/main.go backend/xray_manager.go backend/Dockerfile \
    frontend/app/page.tsx frontend/components/KeyCard.tsx \
    2>/dev/null

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "vpn-backup-*.tar.gz" -mtime +7 -delete

echo "[BACKUP] $(date '+%Y-%m-%d %H:%M:%S') Created: vpn-backup-$DATE.tar.gz"
ls -lh "$BACKUP_DIR/vpn-backup-$DATE.tar.gz"
