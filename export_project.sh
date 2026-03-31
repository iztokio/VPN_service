#!/bin/bash
# Export clean project source code for GitHub push or server migration
# Creates a zip without node_modules, .next, DB files, or secrets

EXPORT_DIR="/tmp/vpn-export"
ARCHIVE="$HOME/vpn_product/vpn-project-export.zip"
PROJECT_DIR="$HOME/vpn_product"

rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR/backend" "$EXPORT_DIR/frontend" "$EXPORT_DIR/xray"

# Backend source
cp "$PROJECT_DIR/backend/main.go" "$EXPORT_DIR/backend/"
cp "$PROJECT_DIR/backend/xray_manager.go" "$EXPORT_DIR/backend/"
cp "$PROJECT_DIR/backend/Dockerfile" "$EXPORT_DIR/backend/"
cp "$PROJECT_DIR/backend/go.mod" "$EXPORT_DIR/backend/" 2>/dev/null
cp "$PROJECT_DIR/backend/go.sum" "$EXPORT_DIR/backend/" 2>/dev/null

# Frontend source (without node_modules and .next)
cp -r "$PROJECT_DIR/frontend/app" "$EXPORT_DIR/frontend/"
cp -r "$PROJECT_DIR/frontend/components" "$EXPORT_DIR/frontend/"
cp "$PROJECT_DIR/frontend/Dockerfile" "$EXPORT_DIR/frontend/"
cp "$PROJECT_DIR/frontend/package.json" "$EXPORT_DIR/frontend/"
cp "$PROJECT_DIR/frontend/next.config.mjs" "$EXPORT_DIR/frontend/"
cp "$PROJECT_DIR/frontend/tsconfig.json" "$EXPORT_DIR/frontend/" 2>/dev/null
cp "$PROJECT_DIR/frontend/tailwind.config.ts" "$EXPORT_DIR/frontend/" 2>/dev/null
cp "$PROJECT_DIR/frontend/postcss.config.mjs" "$EXPORT_DIR/frontend/" 2>/dev/null

# Docker & DevOps
cp "$PROJECT_DIR/docker-compose.yml" "$EXPORT_DIR/"
cp "$PROJECT_DIR/.gitignore" "$EXPORT_DIR/" 2>/dev/null
cp "$PROJECT_DIR/README.md" "$EXPORT_DIR/" 2>/dev/null
cp "$PROJECT_DIR/backup.sh" "$EXPORT_DIR/" 2>/dev/null

# Xray template config (without real keys — REPLACE_ME placeholders)
cat > "$EXPORT_DIR/xray/config.json.template" << 'XEOF'
{
  "log": {"loglevel": "info"},
  "api": {"tag": "api", "services": ["HandlerService", "StatsService", "RoutingService"]},
  "inbounds": [
    {
      "tag": "vless-in", "listen": "0.0.0.0", "port": 443, "protocol": "vless",
      "settings": {"clients": [], "decryption": "none"},
      "streamSettings": {
        "network": "tcp", "security": "reality",
        "realitySettings": {
          "show": false, "dest": "www.microsoft.com:443", "xver": 0,
          "serverNames": ["www.microsoft.com"],
          "privateKey": "REPLACE_ME", "shortIds": ["REPLACE_ME"]
        }
      },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls", "quic"],
        "routeOnly": false
      }
    },
    {"tag": "api-in", "listen": "0.0.0.0", "port": 10085, "protocol": "dokodemo-door", "settings": {"address": "127.0.0.1"}}
  ],
  "outbounds": [{"protocol": "freedom", "tag": "direct", "settings": {"domainStrategy": "UseIPv4"}}, {"protocol": "blackhole", "tag": "block"}],
  "routing": {"domainStrategy": "UseIPv4", "rules": [{"inboundTag": ["api-in"], "outboundTag": "api", "type": "field"}, {"type": "field", "ip": ["::/0"], "outboundTag": "block"}]}
}
XEOF

# Create .env template
cat > "$EXPORT_DIR/.env.example" << 'XEOF'
REALITY_PRIVATE_KEY=REPLACE_ME
REALITY_PUBLIC_KEY=REPLACE_ME
REALITY_SHORT_ID=REPLACE_ME
SERVER_IP=REPLACE_ME
XEOF

cd /tmp && zip -r "$ARCHIVE" vpn-export/
rm -rf "$EXPORT_DIR"

echo ""
echo "================================================"
echo "[EXPORT] Archive created: $ARCHIVE"
ls -lh "$ARCHIVE"
echo ""
echo "[EXPORT] Download command:"
echo "  scp root@$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP'):$ARCHIVE ./vpn-project.zip"
echo "================================================"
