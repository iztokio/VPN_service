#!/bin/bash
# =============================================================
# DEPLOY SCRIPT: Fix Reality DPI Bypass (Step 3)
# =============================================================
# Run on server: bash deploy_fix.sh
# =============================================================

set -e

PROJECT_DIR="$HOME/vpn_product"
cd "$PROJECT_DIR"

echo ""
echo "=============================================="
echo " STEP 1: Verify dest target TLS compatibility"
echo "=============================================="
# addons.mozilla.org must support TLS 1.3 and X25519
echo "Testing addons.mozilla.org TLS connection..."
curl -sv --tlsv1.3 https://addons.mozilla.org 2>&1 | grep -E "(TLS|SSL|Connected|certificate)" | head -10
echo "[OK] If you see TLS 1.3 above, the dest is compatible"

echo ""
echo "=============================================="
echo " STEP 2: Update config.json on server"
echo "  (IMPORTANT: replace SERVER_PRIVATE_KEY and SERVER_SHORT_ID!)"
echo "=============================================="
# The config.json template is sent from local machine via scp.
# On server, replace placeholders:
# sed -i "s/SERVER_PRIVATE_KEY/YOUR_ACTUAL_PRIVATE_KEY/" xray/config.json
# sed -i "s/SERVER_SHORT_ID/YOUR_ACTUAL_SHORT_ID/"      xray/config.json

echo ""
echo "=============================================="
echo " STEP 3: Restart Xray only (zero-downtime)"
echo "=============================================="
docker compose restart xray
sleep 3
docker logs xray --tail 20

echo ""
echo "=============================================="
echo " STEP 4: Rebuild and restart backend"
echo "  (needed for the new SNI in generated URLs)"
echo "=============================================="
docker compose up -d --build vpn_backend
sleep 5
docker logs vpn_backend --tail 20

echo ""
echo "=============================================="
echo " STEP 5: Block Active Probing IPs (TSPU scanner)"
echo "=============================================="
# The IP 94.253.44.171 is a known RU TSPU active prober
# Block it at iptables level so it gets no response at all (RST is better than silence for disguise)
iptables -A INPUT -s 94.253.44.171 -j DROP 2>/dev/null && echo "[BLOCKED] 94.253.44.171" || echo "[NOTE] iptables not available, skip manual block"

# Also block the entire subnet (Flex Ltd / Rostelecom scanner net)
# iptables -A INPUT -s 94.253.44.0/24 -j DROP

echo ""
echo "=============================================="
echo " STEP 6: Verify Reality is working"
echo "=============================================="
echo "Check that port 443 responds like a real HTTPS server:"
echo "  curl -sk https://YOUR_SERVER_IP/ --resolve 'addons.mozilla.org:443:YOUR_SERVER_IP' -o /dev/null -w '%{http_code}'"
echo ""
echo "Expected: should NOT return 400 (that's a Reality probe rejection - OK)"
echo "Expected: TSPU scanner should see a normal TLS connection to addons.mozilla.org"

echo ""
echo "[DONE] Deploy fix complete."
echo "Generate a new KEY via the dashboard and test from Russia."
