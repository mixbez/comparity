#!/bin/bash
# =============================================================================
# Comparity — Auto Deploy (Traefik + Let's Encrypt SSL)
# =============================================================================
set -e

BOT_TOKEN="8648841232:AAHsMJVRAExWZBdXvs37Y2tMYW79KQLZi_s"
DOMAIN="v2202504269079335176.supersrv.de"
BOT_WEBHOOK_URL="https://${DOMAIN}"
MINI_APP_URL="https://${DOMAIN}"
JWT_SECRET="$(openssl rand -hex 32)"

REPO="https://github.com/mixbez/comparity"
BRANCH="claude/telegram-game-mvp-W3VmP"
APP_DIR="/opt/comparity"

echo "========================================="
echo "  Comparity Deploy — $(date)"
echo "========================================="

# 1. Docker
echo "[1/4] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# docker compose plugin (v2)
if ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin 2>/dev/null || \
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
      -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
fi

# 2. Clone / pull
echo "[2/4] Getting app source..."
apt-get install -y git openssl 2>/dev/null || true
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  git clone -b "$BRANCH" "$REPO" "$APP_DIR"
fi

# 3. .env
echo "[3/4] Writing .env..."
cat > "$APP_DIR/.env" <<EOF
BOT_TOKEN=${BOT_TOKEN}
BOT_WEBHOOK_URL=${BOT_WEBHOOK_URL}
MINI_APP_URL=${MINI_APP_URL}
JWT_SECRET=${JWT_SECRET}
DOMAIN=${DOMAIN}
EOF

# 4. Run
echo "[4/4] Starting containers..."
cd "$APP_DIR"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build

echo ""
echo "========================================="
echo "  Done! Waiting for services to start..."
echo "========================================="
sleep 10
docker compose ps

echo ""
echo "App: https://${DOMAIN}"
echo "API: https://${DOMAIN}/api/decks"
